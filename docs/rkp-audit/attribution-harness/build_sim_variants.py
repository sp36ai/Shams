import shutil,os
SRC='/home/user/Shams/functions/src/engine'; J='rkp/watchJudgment.ts'
def edit(path, pairs):
    s=open(path).read()
    for o,n in pairs:
        assert s.count(o)==1,(o[:70],s.count(o)); s=s.replace(o,n,1)
    open(path,'w').write(s)
S7='''
  // SIM S7
  {
    const selfAspect = (ghar: HouseNumber, ruler: Planet): boolean => {
      const p = chart.planets[ruler];
      if (p.house === ghar) return false;
      return SIM_BROAD ? p.aspects.includes(ghar) : ((p.house - 1 + 6) % 12) + 1 === ghar;
    };
    if (selfAspect(targetHouse, targetRuler)) { score += 2; factors.push('SIM self-aspect target'); }
    if (selfAspect(FULFILMENT_HOUSE, fulfilment.ruler)) { score += 2; factors.push('SIM self-aspect 11th'); }
    if (SIM_ELEVENTH_SITS && fulfilment.ruler !== targetRuler && chart.planets[fulfilment.ruler].house === FULFILMENT_HOUSE) { score += 2; factors.push('SIM 11th ruler in 11th'); }
  }

'''
def base(name):
    d=f'/tmp/var/{name}'
    if os.path.exists(d): shutil.rmtree(d)
    shutil.copytree(SRC,d+'/engine'); return d+'/engine'
def s7(name, broad, eleventh):
    e=base(name)
    edit(f'{e}/{J}',[("  // ── 6. Retrogression", S7+"  // ── 6. Retrogression"),
      ("const FULFILMENT_HOUSE: HouseNumber = 11;",f"const FULFILMENT_HOUSE: HouseNumber = 11;\nconst SIM_BROAD = {str(broad).lower()};\nconst SIM_ELEVENTH_SITS = {str(eleventh).lower()};")])
def s4(name, mode):
    e=base(name)
    cond="  const FOUR = ['career', 'legal', 'business', 'finance'].includes(qType);\n"
    if mode=='B1':
        body="    if (GROWING_GHARS.includes(ghar) && FOUR && (dignity === 'FriendlySign' || dignity === 'NeutralSign')) {\n      return 0;\n    }\n"
    else:
        body="    if (GROWING_GHARS.includes(ghar) && !isStrong(dignity)) {\n      if (dignity === 'Debilitated') return -1;\n      if (FOUR) return 0;\n    }\n"
    edit(f'{e}/{J}',[
      ("function witnessWeight(\n  chart: WatchChart,","function witnessWeight(\n  qType: string,\n  chart: WatchChart,"),
      ("    if (!sits) {\n      return -1;\n    }","    if (!sits) {\n      return -1;\n    }\n"+cond+body),
      ("witnessWeight(chart, planet, sits, targetHouse)","witnessWeight(qType, chart, planet, sits, targetHouse)"),
      ("witnessWeight(chart, planet, sits, FULFILMENT_HOUSE)","witnessWeight(qType, chart, planet, sits, FULFILMENT_HOUSE)")])
s7('sim_s7_strict',False,False); s7('sim_s7_broad',True,False); s7('sim_s7_broad_11',True,True)
s4('sim_s4_B1','B1'); s4('sim_s4_B2','B2')
print('built')
