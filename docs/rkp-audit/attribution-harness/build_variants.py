import shutil,os
SRC='/home/user/Shams/functions/src/engine'
J='rkp/watchJudgment.ts'; R='rkp/rules.ts'; H='kp/rules/houseMatrix.ts'
def edit(path, pairs):
    s=open(path).read()
    for o,n in pairs:
        assert s.count(o)==1,(path,o[:60],s.count(o)); s=s.replace(o,n,1)
    open(path,'w').write(s)
def p_nodes(e): edit(f'{e}/{R}',[("in the Ghar they sit in.\n  Rahu: [],\n  Ketu: [],","in the Ghar they sit in.\n  Rahu: [5, 7, 9],\n  Ketu: [5, 7, 9],")])
def p_travel(e): edit(f'{e}/{H}',[("denial: [4, 8], primary: 9","denial: [], primary: 9")])
def p_sign(e): edit(f'{e}/{J}',[
 ("  } else if (rulerPos.dignity === 'EnemySign') {\n    score -= 1;","  } else if (rulerPos.dignity === 'EnemySign') {\n    score -= 2;"),
 ("  } else if (rulerPos.dignity === 'FriendlySign') {\n    score += 1;","  } else if (rulerPos.dignity === 'FriendlySign') {\n    score += 0;")])
def p_scaling(e): edit(f'{e}/{J}',[
 ("    return isStrong(dignity) ? 3 : 2;","    return 2;"),
 ("    if (!sits) {\n      return -1;\n    }","    if (!sits) {\n      return -2;\n    }")])
def p_upa(e): edit(f'{e}/{J}',[
 ("    return GROWING_GHARS.includes(ghar) && isStrong(dignity) ? 2 : -2;","    return -2;"),
 ("    GROWING_GHARS.includes(targetHouse) && isStrong(chart.planets[planet].dignity);","    false;")])
def p_mod(e): edit(f'{e}/{J}',[("const MOVABLE_FACTOR = 0.8;","const MOVABLE_FACTOR = 1;"),("const FIXED_FACTOR = 1.25;","const FIXED_FACTOR = 1;")])
def p_ladder(e):
    s=open(f'{e}/{J}').read()
    a=s.index("function resolveState(input: {"); b=s.index("/**\n * What one witness")
    s=s[:a]+'''function resolveState(input: {
  score: number; retrograde: boolean; rulerWeak: boolean; zuhalHindering: boolean; strongBeneficOnTarget: boolean; obstruction: string;
}): WatchState {
  const { score, retrograde, obstruction, rulerWeak } = input;
  if (score <= -5) return 'BLOCKED';
  if (retrograde) return 'REVERSING';
  if (score >= 5) return 'FULFILLED';
  if (obstruction === 'Saturn' || rulerWeak) return 'DELAYED';
  if (score >= 2) return 'MOVING';
  return 'UNFORMED';
}

'''+s[b:]
    assert s.count("    strongBeneficOnTarget,\n  });")==1
    s=s.replace("    strongBeneficOnTarget,\n  });","    strongBeneficOnTarget,\n    obstruction,\n  });",1)
    open(f'{e}/{J}','w').write(s)
P={'nodes':p_nodes,'travel':p_travel,'sign':p_sign,'scaling':p_scaling,'upa':p_upa,'mod':p_mod,'ladder':p_ladder}
for d in os.listdir('/tmp/var'):
    if d.startswith(('r_','only_','all_')): shutil.rmtree('/tmp/var/'+d)
for k,fn in P.items():
    d=f'/tmp/var/r_{k}'; shutil.copytree(SRC,d+'/engine'); fn(d+'/engine')
    d=f'/tmp/var/only_{k}'; shutil.copytree(SRC,d+'/engine')
    for k2,fn2 in P.items():
        if k2!=k: fn2(d+'/engine')
d='/tmp/var/all_reverted'; shutil.copytree(SRC,d+'/engine')
for fn in P.values(): fn(d+'/engine')
print(sorted(os.listdir('/tmp/var')))
