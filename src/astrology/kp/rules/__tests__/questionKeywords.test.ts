import { classifyQuestion } from '../questionKeywords';

describe('lending and returning questions (owner decision 2026-10-08)', () => {
  it('judges an object lent or held by someone else as lostitem', () => {
    expect(classifyQuestion('Will bilal give my laptop today')).toBe('lostitem');
    expect(classifyQuestion('Will Bilal give my laptop back?')).toBe('lostitem');
    expect(classifyQuestion('Will he return my phone?')).toBe('lostitem');
    expect(classifyQuestion('I lent my car to a friend, will I get it back?')).toBe('lostitem');
    expect(classifyQuestion('کیا وہ میری کتاب واپس کرے گا؟')).toBe('lostitem');
    expect(classifyQuestion('क्या वह मेरी किताब वापस करेगा?')).toBe('lostitem');
  });

  it('judges money lent or owed as finance', () => {
    expect(classifyQuestion('Will he return the money I lent him?')).toBe('finance');
    expect(classifyQuestion('Will he repay me?')).toBe('finance');
    expect(classifyQuestion('Will my brother pay back what he owes?')).toBe('finance');
    expect(classifyQuestion('Will Ahmed return my loan?')).toBe('finance');
    expect(classifyQuestion('کیا وہ میرا قرض واپس کرے گا؟')).toBe('finance');
    // ادھار / उधार (credit) is finance, owner decision 2026-10-08.
    expect(classifyQuestion('کیا وہ میرا ادھار واپس کرے گا؟')).toBe('finance');
    expect(classifyQuestion('क्या वह मेरा उधार वापस करेगा?')).toBe('finance');
    expect(classifyQuestion('Will he return my udhaar?')).toBe('finance');
  });

  it('leaves questions that only look alike with their own type', () => {
    expect(classifyQuestion('Will they give me the job?')).toBe('career');
    expect(classifyQuestion('Will I travel abroad and return?')).toBe('travel');
    expect(classifyQuestion('Will my marriage happen this year?')).toBe('marriage');
    // "udhar" / اُدھر / उधर mean "there", not credit.
    expect(classifyQuestion('Is my lost ring over udhar?')).toBe('lostitem');
    expect(classifyQuestion('क्या मेरी अंगूठी उधर है?')).toBe('general');
  });
});
