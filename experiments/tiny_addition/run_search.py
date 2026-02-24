import json
import math
import random
from dataclasses import dataclass, asdict
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
import trackio

SEED = 42
random.seed(SEED)
torch.manual_seed(SEED)

DIGITS = "0123456789"
TOKENS = ["<bos>", "+", "=", "<eos>"] + list(DIGITS)
STOI = {t: i for i, t in enumerate(TOKENS)}
ITOS = {i: t for t, i in STOI.items()}
VOCAB = len(TOKENS)
SEQ_LEN = 35

def encode_example(a: int, b: int):
    a_str = f"{a:010d}"[::-1]
    b_str = f"{b:010d}"[::-1]
    c = a + b
    c_str = f"{c:011d}"[::-1]
    toks = ["<bos>"] + list(a_str) + ["+"] + list(b_str) + ["="] + list(c_str) + ["<eos>"]
    assert len(toks) == SEQ_LEN
    ids = torch.tensor([STOI[t] for t in toks], dtype=torch.long)
    target = ids.clone()
    mask = torch.zeros_like(ids, dtype=torch.float32)
    eq_idx = toks.index("=")
    mask[eq_idx + 1 :] = 1.0
    return ids, target, mask


def validate_dataset(samples):
    for a, b in samples[:2000]:
        ids, _, _ = encode_example(a, b)
        toks = [ITOS[i.item()] for i in ids]
        a_rev = "".join(toks[1:11])
        b_rev = "".join(toks[12:22])
        c_rev = "".join(toks[23:34])
        assert int(a_rev[::-1]) == a
        assert int(b_rev[::-1]) == b
        assert int(c_rev[::-1]) == a + b


class TinyTransformer(nn.Module):
    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        self.tok_emb = nn.Embedding(VOCAB, d_model)
        self.ln1 = nn.LayerNorm(d_model)
        self.q = nn.Linear(d_model, d_model)
        self.k = nn.Linear(d_model, d_model)
        self.v = nn.Linear(d_model, d_model)
        self.proj = nn.Linear(d_model, d_model)
        self.ln2 = nn.LayerNorm(d_model)
        self.fc1 = nn.Linear(d_model, d_ff)
        self.fc2 = nn.Linear(d_ff, d_model)
        self.ln_f = nn.LayerNorm(d_model)

    def forward(self, x):
        h = self.tok_emb(x)
        r = h
        h = self.ln1(h)
        q, k, v = self.q(h), self.k(h), self.v(h)
        att = (q @ k.transpose(-2, -1)) / math.sqrt(q.size(-1))
        mask = torch.triu(torch.ones(att.size(-2), att.size(-1), device=att.device), diagonal=1).bool()
        att = att.masked_fill(mask, float("-inf"))
        att = F.softmax(att, dim=-1)
        h = self.proj(att @ v)
        h = r + h
        r2 = h
        h = self.ln2(h)
        h = self.fc2(F.gelu(self.fc1(h)))
        h = r2 + h
        h = self.ln_f(h)
        logits = h @ self.tok_emb.weight.T
        return logits


@dataclass
class Attempt:
    name: str
    d_model: int
    d_ff: int
    lr: float
    epochs: int
    batch_size: int


def count_params(model):
    return sum(p.numel() for p in model.parameters())


def build_dataset(n, rng):
    seen = set()
    pairs = []
    while len(pairs) < n:
        a = rng.randrange(10**10)
        b = rng.randrange(10**10)
        if (a, b) in seen:
            continue
        seen.add((a, b))
        pairs.append((a, b))
    return pairs


def batchify(pairs, bs):
    for i in range(0, len(pairs), bs):
        chunk = pairs[i : i + bs]
        x, y, m = zip(*(encode_example(a, b) for a, b in chunk), strict=False)
        yield torch.stack(x), torch.stack(y), torch.stack(m)


def evaluate(model, pairs, bs=512):
    model.eval()
    tok_correct = tok_total = 0
    seq_correct = seq_total = 0
    with torch.no_grad():
        for x, y, m in batchify(pairs, bs):
            logits = model(x)
            pred = logits.argmax(-1)
            cmp = (pred == y) & (m > 0)
            tok_correct += cmp.sum().item()
            tok_total += (m > 0).sum().item()
            seq_ok = cmp.sum(dim=1) == (m > 0).sum(dim=1)
            seq_correct += seq_ok.sum().item()
            seq_total += x.size(0)
    return tok_correct / tok_total, seq_correct / seq_total


def train_attempt(attempt: Attempt, train_pairs, val_pairs, out_dir: Path):
    model = TinyTransformer(attempt.d_model, attempt.d_ff)
    n_params = count_params(model)
    run = trackio.init(
        project="tiny-10digit-addition",
        name=attempt.name,
        config={**asdict(attempt), "params": n_params, "seed": SEED},
    )
    opt = torch.optim.AdamW(model.parameters(), lr=attempt.lr, weight_decay=0.01)

    history = []
    step = 0
    for epoch in range(1, attempt.epochs + 1):
        random.shuffle(train_pairs)
        model.train()
        total_loss = 0.0
        total_count = 0.0
        for x, y, m in batchify(train_pairs, attempt.batch_size):
            logits = model(x)
            loss = F.cross_entropy(logits.view(-1, VOCAB), y.view(-1), reduction="none")
            loss = (loss * m.view(-1)).sum() / m.sum()
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            total_loss += loss.item() * m.sum().item()
            total_count += m.sum().item()
            step += 1

        train_loss = total_loss / total_count
        train_tok, train_seq = evaluate(model, train_pairs[:4096])
        val_tok, val_seq = evaluate(model, val_pairs)
        metrics = {
            "epoch": epoch,
            "train_loss": train_loss,
            "train_tok_acc": train_tok,
            "train_seq_acc": train_seq,
            "val_tok_acc": val_tok,
            "val_seq_acc": val_seq,
            "params": n_params,
        }
        trackio.log(metrics, step=epoch)
        history.append(metrics)
        print(attempt.name, metrics, flush=True)
        if val_seq >= 0.999 and epoch >= 3:
            break

    run.finish()
    out = {
        "attempt": asdict(attempt),
        "params": n_params,
        "best_val_seq_acc": max(h["val_seq_acc"] for h in history),
        "best_val_tok_acc": max(h["val_tok_acc"] for h in history),
        "last": history[-1],
        "history": history,
    }
    (out_dir / f"{attempt.name}.json").write_text(json.dumps(out, indent=2))
    return out


def main():
    out_dir = Path("experiments/tiny_addition/results")
    out_dir.mkdir(parents=True, exist_ok=True)

    rng_train = random.Random(123)
    rng_val = random.Random(456)
    print("building datasets...", flush=True)
    train_pairs = build_dataset(40_000, rng_train)
    val_pairs = build_dataset(4_000, rng_val)

    # dataset checks
    assert set(train_pairs).isdisjoint(set(val_pairs))
    validate_dataset(train_pairs)
    validate_dataset(val_pairs)
    print("dataset checks passed", flush=True)

    attempts = [
        Attempt("a_d4_ff8", 4, 8, 2e-3, 12, 256),
        Attempt("b_d5_ff10", 5, 10, 2e-3, 12, 256),
        Attempt("c_d6_ff12", 6, 12, 2e-3, 12, 256),
        Attempt("d_d6_ff14", 6, 14, 1.5e-3, 12, 256),
        Attempt("e_d6_ff16", 6, 16, 1.5e-3, 12, 256),
    ]

    summaries = []
    for attempt in attempts:
        result = train_attempt(attempt, train_pairs, val_pairs, out_dir)
        summaries.append(result)

    (out_dir / "attempt_summary.json").write_text(json.dumps(summaries, indent=2))
    best = max(summaries, key=lambda x: x["best_val_seq_acc"])
    print("BEST", best["attempt"]["name"], best["params"], best["best_val_seq_acc"])


if __name__ == "__main__":
    main()
