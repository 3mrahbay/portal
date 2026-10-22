// Non-mutating safety gate for bank e-mail reconciliation.
// E-mail notices are hints, not bank-verified funds. This module never writes
// Firestore, never sends a receipt, and never returns permission to auto-post.
const cents = value => {
  const n=Number(value);
  return Number.isFinite(n)&&n>0&&Number.isSafeInteger(n)?n:null;
};
const uniq = items => [...new Set(items.map(String))];
export function reviewBankPayment(input={}) {
  const bank=input.bank||{};
  const matches=Array.isArray(input.matches)?input.matches:[];
  const reason=[];
  const result=(status,priority)=>({status,priority,reasons:reason,allowAutomaticPosting:false});
  if(bank.classification==='own_account_transfer_review' || bank.classification==='merchant_settlement_or_transfer_review') {
    reason.push('Kendi hesapları veya POS takası okul tahsilatı değildir.');
    return result('exclude_from_student_income','high');
  }
  if(bank.direction==='out') {
    reason.push('Giden havale öğrencinin tahsilat planına işlenemez.');
    return result('expense_or_salary_review','high');
  }
  if(bank.classification==='other_incoming_review' || bank.type==='pos_statement') {
    reason.push('İade veya toplu hesap hareketi ayrı muhasebeleştirilmelidir.');
    return result('non_tuition_review','medium');
  }
  if(bank.direction!=='in' || !['transfer_in','transfer_in_other','pos_sale'].includes(bank.type)) {
    reason.push('Öğrenci tahsilatı olarak tanınan bir para girişi değil.');
    return result('unsupported_notice','medium');
  }
  const amount=cents(bank.amountKurus);
  if(!amount || !/^\d{4}-\d{2}-\d{2}$/.test(String(bank.date||''))) {
    reason.push('Geçerli işlem tarihi veya kuruş tutarı yok.');
    return result('missing_bank_details','high');
  }
  const identities=uniq(matches.filter(m=>m.studentId).map(m=>m.studentId));
  if(identities.length>1 || matches.some(m=>m.identityConflict)) {
    reason.push('Birden fazla öğrenci kimliği veya farklı dönem kaydı çakışıyor.');
    return result('identity_conflict','high');
  }
  if(!matches.length || !identities.length) {
    reason.push('Tanımlanmış tek bir öğrenci bulunamadı.');
    return result('unmatched_student','medium');
  }
  const periods=uniq(matches.filter(m=>m.period).map(m=>m.period));
  if(periods.length!==1 || !/^\d{4}-\d{4}$/.test(periods[0])) {
    reason.push('Ödeme tarihi eğitim yılını tek başına belirlemez; dönem doğrulanmalı.');
    return result('ambiguous_period','high');
  }
  const items=uniq(matches.filter(m=>m.itemId).map(m=>m.itemId));
  if(items.length!==1) {
    reason.push('Tek bir ücret kalemi veya taksit belirlenemedi.');
    return result('ambiguous_installment','high');
  }
  if(matches.some(m=>m.existingPaymentCandidate===true)) {
    reason.push('İlgili tutar/tarih/taksit mevcut kayıtta ödenmiş görünüyor; mükerrer tahsilat oluşturma.');
    return result('protect_existing_payment','high');
  }
  if(matches.some(m=>m.bankReferenceUsed===true)) {
    reason.push('Banka referansı daha önce eşleştirilmiş olabilir.');
    return result('possible_duplicate','high');
  }
  const remaining=matches.map(m=>m.remainingKurus).filter(v=>Number.isSafeInteger(v));
  if(remaining.length!==1 || remaining[0]<amount) {
    reason.push('Kalan bakiye, kısmi ödeme veya fazla ödeme manuel kontrol gerektirir.');
    return result('amount_or_balance_review','high');
  }
  if(bank.verifiedByBank!==true || !bank.transactionRef) {
    reason.push('E-posta tek başına banka teyidi değildir; gerçek işlem referansı doğrulanmalı.');
    return result('bank_evidence_needed','high');
  }
  reason.push('İlk sürüm yalnızca muhasebe onay kuyruğuna aday üretir.');
  return result('finance_approval_required','medium');
}
