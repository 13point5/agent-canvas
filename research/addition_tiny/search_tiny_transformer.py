import itertools, json, random
from dataclasses import dataclass, asdict
from pathlib import Path
import torch
import torch.nn as nn
import torch.nn.functional as F
import trackio

SEED=42
random.seed(SEED); torch.manual_seed(SEED)
TOKENS=[str(i) for i in range(10)]+['C0','C1','CLS']
stoi={t:i for i,t in enumerate(TOKENS)}; CLS=stoi['CLS']


def dataset():
    X=[]; Yd=[]; Yc=[]
    for a,b,c in itertools.product(range(10),range(10),[0,1]):
        s=a+b+c
        X.append([stoi[str(a)],stoi[str(b)],stoi[f'C{c}'],CLS]); Yd.append(s%10); Yc.append(s//10)
    X=torch.tensor(X); Yd=torch.tensor(Yd); Yc=torch.tensor(Yc)
    for i in range(len(X)):
        a=int(TOKENS[X[i,0]]); b=int(TOKENS[X[i,1]]); c=0 if TOKENS[X[i,2]]=='C0' else 1
        assert (a+b+c)%10==Yd[i] and (a+b+c)//10==Yc[i]
    return X,Yd,Yc

class M(nn.Module):
    def __init__(self,d):
        super().__init__()
        self.te=nn.Embedding(len(TOKENS),d); self.pe=nn.Embedding(4,d)
        self.ln1=nn.LayerNorm(d); self.attn=nn.MultiheadAttention(d,1,batch_first=True)
        self.ln2=nn.LayerNorm(d)
        self.d=nn.Linear(d,10); self.c=nn.Linear(d,2)
    def forward(self,x):
        p=torch.arange(4)
        h=self.te(x)+self.pe(p)[None]
        a=self.attn(self.ln1(h),self.ln1(h),self.ln1(h),need_weights=False)[0]
        h=self.ln2(h+a)[:,-1]
        return self.d(h),self.c(h)


def params(m): return sum(p.numel() for p in m.parameters())

@torch.no_grad()
def eval_col(m,X,Yd,Yc):
    d,c=m(X); pd=d.argmax(-1); pc=c.argmax(-1)
    return float(((pd==Yd)&(pc==Yc)).float().mean())

@torch.no_grad()
def eval_full(m,n=500):
    ok=0
    for _ in range(n):
        a=random.randint(0,10**10-1); b=random.randint(0,10**10-1)
        carry=0; out=[]
        sa,sb=f"{a:010d}"[::-1],f"{b:010d}"[::-1]
        for i in range(10):
            x=torch.tensor([[stoi[sa[i]],stoi[sb[i]],stoi[f'C{carry}'],CLS]])
            d,c=m(x); digit=int(d.argmax()); carry=int(c.argmax()); out.append(str(digit))
        if carry: out.append('1')
        pred=int(''.join(out[::-1]))
        ok += pred==(a+b)
    return ok/n

@dataclass
class A: name:str; d:int; lr:float; steps:int

X,Yd,Yc=dataset()
attempts=[A('a1',2,0.03,800),A('a2',3,0.03,1000),A('a3',4,0.02,1000),A('a4',5,0.02,1200)]
run=trackio.init(project='tiny-transformer-addition',name='column-search-fast',embed=False,config={'seed':SEED})
results=[]
for a in attempts:
    m=M(a.d); p=params(m)
    if p>=491: continue
    opt=torch.optim.Adam(m.parameters(),lr=a.lr)
    for s in range(a.steps):
        d,c=m(X); loss=F.cross_entropy(d,Yd)+F.cross_entropy(c,Yc)
        opt.zero_grad(); loss.backward(); opt.step()
    col=eval_col(m,X,Yd,Yc); full=eval_full(m,500)
    trackio.log({'attempt':a.name,'params':p,'column_acc':col,'full_10digit_acc':full})
    results.append({**asdict(a),'params':p,'column_acc':col,'full_10digit_acc':full})

run.finish()
Path('research/addition_tiny').mkdir(parents=True,exist_ok=True)
Path('research/addition_tiny/attempt_log.json').write_text(json.dumps(results,indent=2))
succ=sorted([r for r in results if r['full_10digit_acc']==1.0], key=lambda x:x['params'])
best=succ[0] if succ else max(results,key=lambda x:x['full_10digit_acc'])
Path('research/addition_tiny/report.html').write_text(f"""<!doctype html><html><body><article>
# Tiny Transformer under 491 parameters for 10-digit addition

## Method
We train a transformer to learn one-column addition state transition `(a,b,carry_in)->(digit,carry_out)` over all 200 exact states, then unroll it over 10 columns.

## Attempts
{json.dumps(results,indent=2)}

## Best under 491 params
Smallest successful (full_10digit_acc=1.0 if available): {best}

Trackio project: tiny-transformer-addition.
</article></body></html>""")
print('done',results)
