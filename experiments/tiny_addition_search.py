import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
import trackio

DEVICE = "cpu"
VOCAB_SIZE = 12  # 0-9 + <OUT> + '+'
OUT_TOKEN = 10
PLUS_TOKEN = 11
SEQ_LEN = 32
OUT_LEN = 11

POW10_10 = torch.tensor([10**i for i in range(10)], dtype=torch.long)
POW10_11 = torch.tensor([10**i for i in range(11)], dtype=torch.long)


def make_batch(batch_size: int):
    a = torch.randint(0, 10**10, (batch_size,), dtype=torch.long)
    b = torch.randint(0, 10**10, (batch_size,), dtype=torch.long)
    s = a + b

    a_digits = ((a[:, None] // POW10_10[None, :]) % 10).long()
    b_digits = ((b[:, None] // POW10_10[None, :]) % 10).long()
    s_digits = ((s[:, None] // POW10_11[None, :]) % 10).long()

    x = torch.full((batch_size, SEQ_LEN), OUT_TOKEN, dtype=torch.long)
    x[:, 11:21] = a_digits
    x[:, 21] = PLUS_TOKEN
    x[:, 22:32] = b_digits

    # dataset integrity check
    if not torch.equal((a_digits * POW10_10).sum(dim=1), a):
        raise RuntimeError("A digits failed reconstruction check")
    if not torch.equal((b_digits * POW10_10).sum(dim=1), b):
        raise RuntimeError("B digits failed reconstruction check")
    if not torch.equal((s_digits * POW10_11).sum(dim=1), s):
        raise RuntimeError("Sum digits failed reconstruction check")

    return x.to(DEVICE), s_digits.to(DEVICE)


class TinyTransformerBlock(nn.Module):
    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(d_model, num_heads=1, batch_first=True)
        self.ln2 = nn.LayerNorm(d_model)
        self.ff1 = nn.Linear(d_model, d_ff)
        self.ff2 = nn.Linear(d_ff, d_model)

    def forward(self, x):
        h = self.ln1(x)
        attn_out, _ = self.attn(h, h, h, need_weights=False)
        x = x + attn_out
        h = self.ln2(x)
        x = x + self.ff2(F.relu(self.ff1(h)))
        return x


class TinyAdditionTransformer(nn.Module):
    def __init__(self, d_model: int, d_ff: int, n_layers: int):
        super().__init__()
        self.token_embed = nn.Embedding(VOCAB_SIZE, d_model)
        self.pos_embed = nn.Embedding(SEQ_LEN, d_model)
        self.blocks = nn.ModuleList(
            [TinyTransformerBlock(d_model=d_model, d_ff=d_ff) for _ in range(n_layers)]
        )
        self.final_ln = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, 10)

    def forward(self, x):
        pos = torch.arange(SEQ_LEN, device=x.device)[None, :]
        h = self.token_embed(x) + self.pos_embed(pos)
        for block in self.blocks:
            h = block(h)
        h = self.final_ln(h[:, :OUT_LEN])
        return self.head(h)


def param_count(model: nn.Module):
    return sum(p.numel() for p in model.parameters())


@torch.no_grad()
def evaluate(model: nn.Module, batches: int = 30, batch_size: int = 512):
    model.eval()
    tok_acc = 0.0
    seq_acc = 0.0
    for _ in range(batches):
        x, y = make_batch(batch_size)
        pred = model(x).argmax(dim=-1)
        tok_acc += (pred == y).float().mean().item()
        seq_acc += (pred == y).all(dim=-1).float().mean().item()
    return tok_acc / batches, seq_acc / batches


@dataclass
class AttemptResult:
    d_model: int
    d_ff: int
    n_layers: int
    params: int
    train_loss: float
    val_token_acc: float
    val_seq_acc: float


def run_attempt(cfg, steps: int, batch_size: int, lr: float, run):
    model = TinyAdditionTransformer(**cfg).to(DEVICE)
    params = param_count(model)

    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    train_loss = math.inf

    for step in range(1, steps + 1):
        model.train()
        x, y = make_batch(batch_size)
        logits = model(x)
        loss = F.cross_entropy(logits.reshape(-1, 10), y.reshape(-1))

        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()

        train_loss = loss.item()
        if step % 200 == 0:
            run.log(
                {
                    "attempt": f"d{cfg['d_model']}_ff{cfg['d_ff']}_l{cfg['n_layers']}",
                    "train_step": step,
                    "train/loss": train_loss,
                }
            )

    val_tok, val_seq = evaluate(model)
    run.log(
        {
            "attempt": f"d{cfg['d_model']}_ff{cfg['d_ff']}_l{cfg['n_layers']}",
            "final/train_loss": train_loss,
            "final/val_token_acc": val_tok,
            "final/val_seq_acc": val_seq,
            "model/params": params,
        }
    )

    return AttemptResult(
        d_model=cfg["d_model"],
        d_ff=cfg["d_ff"],
        n_layers=cfg["n_layers"],
        params=params,
        train_loss=train_loss,
        val_token_acc=val_tok,
        val_seq_acc=val_seq,
    )


def write_report(results, selected, path: Path):
    rows = "\n".join(
        f"<tr><td>{i+1}</td><td>{r.d_model}</td><td>{r.d_ff}</td><td>{r.n_layers}</td><td>{r.params}</td><td>{r.train_loss:.4f}</td><td>{r.val_token_acc:.4f}</td><td>{r.val_seq_acc:.4f}</td></tr>"
        for i, r in enumerate(results)
    )

    html = f"""<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>Tiny Transformer Search for 10-digit Addition</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 40px; line-height: 1.5; }}
    table {{ border-collapse: collapse; width: 100%; margin-top: 1rem; }}
    th, td {{ border: 1px solid #ccc; padding: 8px; text-align: right; }}
    th:first-child, td:first-child {{ text-align: center; }}
    h1, h2 {{ margin-bottom: 0.25rem; }}
    code {{ background: #f5f5f5; padding: 2px 5px; }}
  </style>
</head>
<body>
<article>
<h1>Smallest Transformer (&lt;491 params) for 10-digit Addition</h1>
<p><strong>MDX-style abstract:</strong> We construct a family of tiny transformer encoders and train each on randomly sampled pairs of 10-digit integers. Inputs are <code>[OUT x11] + rev(a) + '+' + rev(b)</code> and targets are <code>rev(a+b)</code>. We enforce dataset integrity with exact reconstruction checks before training every batch.</p>

<h2>Method</h2>
<ul>
<li>Framework: PyTorch CPU only.</li>
<li>Tracking: Hugging Face trackio local run logs.</li>
<li>Validation metrics: token accuracy and full-sequence exact match.</li>
<li>Constraint: strictly fewer than 491 trainable parameters.</li>
</ul>

<h2>Parameter math</h2>
<p>For fixed vocabulary (12 tokens), sequence length (32), output length (11), and one-head attention, total parameters are computed exactly by PyTorch tensor shapes. We evaluate candidates in ascending size and pick the smallest high-performing model under the hard limit.</p>

<h2>Attempt log</h2>
<table>
<thead><tr><th>#</th><th>d_model</th><th>d_ff</th><th>layers</th><th>params</th><th>train loss</th><th>val token acc</th><th>val seq acc</th></tr></thead>
<tbody>
{rows}
</tbody>
</table>

<h2>Conclusion</h2>
<p>Best under-491 model: <strong>d_model={selected.d_model}, d_ff={selected.d_ff}, layers={selected.n_layers}, params={selected.params}</strong>.</p>
<p>This is the smallest architecture in our tested set that achieved the top validation sequence accuracy while respecting the parameter budget.</p>
</article>
</body>
</html>"""
    path.write_text(html)


def main():
    attempts = [
        {"d_model": 2, "d_ff": 8, "n_layers": 1},
        {"d_model": 3, "d_ff": 8, "n_layers": 1},
        {"d_model": 4, "d_ff": 8, "n_layers": 1},
        {"d_model": 5, "d_ff": 4, "n_layers": 1},
        {"d_model": 5, "d_ff": 5, "n_layers": 1},
    ]



    run = trackio.init(
        project="tiny-transformer-addition",
        name="under-491-search",
        config={"device": DEVICE, "task": "10-digit addition"},
    )

    results = []
    for cfg in attempts:
        result = run_attempt(cfg, steps=120, batch_size=256, lr=3e-3, run=run)
        results.append(result)
        print(asdict(result))

    valid = [r for r in results if r.params < 491]
    valid.sort(key=lambda r: (-r.val_seq_acc, r.params))
    selected = valid[0]

    out_dir = Path("reports")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "attempt_log.json").write_text(
        json.dumps([asdict(r) for r in results], indent=2)
    )
    write_report(results, selected, out_dir / "tiny_transformer_addition_report.html")

    run.log(
        {
            "selected/params": selected.params,
            "selected/val_token_acc": selected.val_token_acc,
            "selected/val_seq_acc": selected.val_seq_acc,
        }
    )
    run.finish()


if __name__ == "__main__":
    main()
