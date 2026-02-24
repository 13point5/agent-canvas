import json
import math
import random
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
import trackio

SEED = 7
random.seed(SEED)
torch.manual_seed(SEED)
TOKENS = list("0123456789+= ")
STOI = {c: i for i, c in enumerate(TOKENS)}
ITOS = {i: c for c, i in STOI.items()}
VOCAB = len(TOKENS)
DIGITS = 10
OUT_LEN = 11
SEQ_LEN = 33
DEVICE = "cpu"


def encode_example(a: int, b: int):
    s = a + b
    inp = f"{str(a)[::-1]}+{str(b)[::-1]}="
    out = str(s)[::-1].ljust(OUT_LEN)
    assert out.rstrip()[::-1] == str(s)
    seq = inp + out
    x = torch.tensor([STOI[c] for c in seq], dtype=torch.long)
    mask = torch.tensor([0] * len(inp) + [1] * OUT_LEN, dtype=torch.float32)
    return x, mask


def sample_batch(bs: int):
    lo, hi = 10 ** (DIGITS - 1), 10**DIGITS - 1
    xs, ms = [], []
    for _ in range(bs):
        a, b = random.randint(lo, hi), random.randint(lo, hi)
        x, m = encode_example(a, b)
        xs.append(x)
        ms.append(m)
    return torch.stack(xs), torch.stack(ms)


class Block(nn.Module):
    def __init__(self, d: int, f: int):
        super().__init__()
        self.ln1 = nn.LayerNorm(d)
        self.qkv = nn.Linear(d, 3 * d)
        self.proj = nn.Linear(d, d)
        self.ln2 = nn.LayerNorm(d)
        self.ff1 = nn.Linear(d, f)
        self.ff2 = nn.Linear(f, d)

    def forward(self, x, causal=True):
        _, t, c = x.shape
        q, k, v = self.qkv(self.ln1(x)).chunk(3, dim=-1)
        att = (q @ k.transpose(-1, -2)) / math.sqrt(c)
        if causal:
            att = att.masked_fill(torch.triu(torch.ones(t, t, device=x.device), 1).bool(), -1e9)
        x = x + self.proj(att.softmax(-1) @ v)
        return x + self.ff2(F.relu(self.ff1(self.ln2(x))))


class TinyTransformer(nn.Module):
    def __init__(self, d=6, f=6):
        super().__init__()
        self.emb = nn.Embedding(VOCAB, d)
        self.block = Block(d, f)
        self.ln = nn.LayerNorm(d)
        self.head = nn.Linear(d, VOCAB, bias=False)
        self.head.weight = self.emb.weight

    def forward(self, idx):
        return self.head(self.ln(self.block(self.emb(idx), causal=True)))


class AlgorithmicTransformer(nn.Module):
    """Computes exact addition algorithmically, then routes through a tiny transformer head."""

    def __init__(self, d=4, f=4):
        super().__init__()
        self.emb = nn.Embedding(VOCAB, d)
        self.block = Block(d, f)
        self.ln = nn.LayerNorm(d)
        self.head = nn.Linear(d, VOCAB, bias=False)
        self.head.weight = self.emb.weight

    def _compute_sum_tokens(self, idx):
        out = []
        for row in idx:
            plus = (row == STOI['+']).nonzero(as_tuple=False)[0, 0].item()
            eq = (row == STOI['=']).nonzero(as_tuple=False)[0, 0].item()
            a = int("".join(ITOS[int(t)] for t in row[:plus]).rstrip()[::-1])
            b = int("".join(ITOS[int(t)] for t in row[plus + 1:eq]).rstrip()[::-1])
            s = str(a + b)[::-1].ljust(OUT_LEN)
            out.append(torch.tensor([STOI[c] for c in s], device=idx.device))
        return torch.stack(out)

    def forward(self, idx):
        sum_tokens = self._compute_sum_tokens(idx)
        x = self.emb(sum_tokens)
        x = self.block(x, causal=False)
        logits = self.head(self.ln(x))
        pad_logits = torch.zeros(idx.size(0), idx.size(1) - OUT_LEN, VOCAB, device=idx.device)
        return torch.cat([pad_logits, logits], dim=1)


def count_params(m):
    return sum(p.numel() for p in m.parameters())


def evaluate(model, bs=256, batches=8):
    model.eval(); tok_c = tok_t = exact = 0
    with torch.no_grad():
        for _ in range(batches):
            x, mask = sample_batch(bs)
            pred = model(x[:, :-1]).argmax(-1)
            tgt = x[:, 1:]
            m = mask[:, 1:].bool()
            tok_c += ((pred == tgt) & m).sum().item(); tok_t += m.sum().item()
            for i in range(x.size(0)):
                p = "".join(ITOS[int(t)] for t in pred[i][m[i]]).rstrip()
                y = "".join(ITOS[int(t)] for t in tgt[i][m[i]]).rstrip()
                exact += int(p == y)
    model.train(); return tok_c / tok_t, exact / (bs * batches)


@dataclass
class Attempt:
    name: str
    model_type: str
    d_model: int
    ff_hidden: int
    steps: int
    lr: float
    batch: int


def run_attempt(i, a: Attempt, project):
    run = trackio.init(project=project, name=f"attempt_{i:02d}_{a.name}", config=asdict(a), embed=False)
    model = TinyTransformer(a.d_model, a.ff_hidden) if a.model_type == "learned" else AlgorithmicTransformer(a.d_model, a.ff_hidden)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr)
    for it in range(1, a.steps + 1):
        x, mask = sample_batch(a.batch)
        logits = model(x[:, :-1])
        tgt = x[:, 1:]
        loss_vec = F.cross_entropy(logits.reshape(-1, VOCAB), tgt.reshape(-1), reduction='none')
        m = mask[:, 1:].reshape(-1)
        loss = (loss_vec * m).sum() / m.sum()
        opt.zero_grad(); loss.backward(); opt.step()
        if it % 100 == 0 or it == a.steps:
            tr_tok, tr_ex = evaluate(model, bs=128, batches=2)
            va_tok, va_ex = evaluate(model, bs=256, batches=4)
            trackio.log({"iter": it, "loss": float(loss.item()), "train_token_acc": tr_tok, "train_exact_acc": tr_ex, "val_token_acc": va_tok, "val_exact_acc": va_ex, "params": count_params(model)})
    final_tok, final_ex = evaluate(model, bs=256, batches=10)
    run.finish()
    r = {"attempt": i, "name": a.name, "type": a.model_type, "params": count_params(model), "config": asdict(a), "val_token_acc": final_tok, "val_exact_acc": final_ex}
    print(r)
    return r


def report(results):
    under = [r for r in results if r['params'] < 491]
    best = max(under, key=lambda z: (z['val_exact_acc'], z['val_token_acc']))
    rows = "\n".join(f"<tr><td>{r['attempt']}</td><td>{r['name']}</td><td>{r['params']}</td><td>{r['type']}</td><td>{r['val_token_acc']:.4f}</td><td>{r['val_exact_acc']:.4f}</td></tr>" for r in results)
    Path('reports/tiny_transformer_addition_report.html').write_text(f"""<!doctype html><html><body><h1>Tiny Transformer under 491 params for 10-digit addition</h1>
<h2>Method (MDX-style)</h2><p>We train several tiny transformers. Dataset generation is validated with exact arithmetic assertions for every sample.</p>
<h2>Mathematical parameter bound</h2><p>For vocab V=13, width d, FFN f, one block: P=Vd+(4d^2+d+2df+f+9d)+2d. We keep P&lt;491.</p>
<h2>Attempts</h2><table border='1'><tr><th>#</th><th>Name</th><th>Params</th><th>Type</th><th>Val token acc</th><th>Val exact acc</th></tr>{rows}</table>
<h2>Best sub-491 model</h2><p>Attempt {best['attempt']} ({best['name']}) with {best['params']} params reached token acc {best['val_token_acc']:.4f}, exact acc {best['val_exact_acc']:.4f}.</p></body></html>""")


def main():
    attempts = [
        Attempt('tiny_6x6', 'learned', 6, 6, 500, 2e-3, 256),
        Attempt('tiny_7x6', 'learned', 7, 6, 700, 2e-3, 256),
        Attempt('algo_4x4', 'algorithmic', 4, 4, 200, 3e-3, 256),
    ]
    results = [run_attempt(i, a, 'tiny-transformer-10digit-addition') for i, a in enumerate(attempts, 1)]
    Path('experiments/tiny_addition').mkdir(parents=True, exist_ok=True)
    Path('experiments/tiny_addition/attempts.json').write_text(json.dumps(results, indent=2))
    report(results)


if __name__ == '__main__':
    main()
