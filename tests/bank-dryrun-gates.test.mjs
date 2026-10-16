import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewBankPayment} from '../js/finans/bank-dryrun-gates.js';
const bank={direction:'in',type:'transfer_in',amountKurus:3250000,date:'2026-10-06',classification:'student_payment_candidate',verifiedByBank:false,transactionRef:''};
const match={studentId:'student-1',period:'2026-2027',itemId:'2026-10',remainingKurus:3250000};
const evaluate=(b=bank,m=[match])=>reviewBankPayment({bank:b,matches:m});

test('every decision denies automatic finance writes',()=>{
 const cases=[
  evaluate(),
  evaluate({...bank,verifiedByBank:true,transactionRef:'bank-ref-1'}),
  evaluate({...bank,classification:'own_account_transfer_review'}),
  evaluate({...bank,direction:'out',type:'transfer_out'}),
  evaluate({...bank,amountKurus:null}),
  evaluate(bank,[]),
  evaluate(bank,[match,{...match,studentId:'student-2'}]),
  evaluate(bank,[{...match,existingPaymentCandidate:true}])
 ];
 assert.ok(cases.every(x=>x.allowAutomaticPosting===false));
});
test('known paid installment is protected even without actual bank reference',()=>{
 assert.equal(evaluate(bank,[{...match,existingPaymentCandidate:true}]).status,'protect_existing_payment');
});
test('an ambiguous sibling identity goes to review instead of selecting a child',()=>{
 assert.equal(evaluate(bank,[match,{...match,studentId:'student-2'}]).status,'identity_conflict');
});
test('unknown study period cannot be inferred from bank date',()=>{
 assert.equal(evaluate(bank,[{...match,period:''}]).status,'ambiguous_period');
});
test('the same student with multiple charge items requires review',()=>{
 assert.equal(evaluate(bank,[match,{...match,itemId:'2026-09'}]).status,'ambiguous_installment');
});
test('incoming from own account is never booked as tuition',()=>{
 assert.equal(evaluate({...bank,classification:'own_account_transfer_review'}).status,'exclude_from_student_income');
});
test('outgoing salary requires a separate expense workflow',()=>{
 assert.equal(evaluate({...bank,direction:'out',type:'transfer_out'}).status,'expense_or_salary_review');
});
test('bank evidence and unique transaction reference are required before approval',()=>{
 assert.equal(evaluate().status,'bank_evidence_needed');
 assert.equal(evaluate({...bank,verifiedByBank:true,transactionRef:'bank-ref-1'}).status,'finance_approval_required');
});
test('bank reference already used is rejected as possible duplicate',()=>{
 assert.equal(evaluate(bank,[{...match,bankReferenceUsed:true}]).status,'possible_duplicate');
});
test('partial, invalid and excessive payments cannot be silently closed',()=>{
 assert.equal(evaluate(bank,[{...match,remainingKurus:2000000}]).status,'amount_or_balance_review');
 assert.equal(evaluate({...bank,amountKurus:null}).status,'missing_bank_details');
});
test('refunds, settlement batches and POS statement are not tuition payments',()=>{
 assert.equal(evaluate({...bank,classification:'other_incoming_review'}).status,'non_tuition_review');
 assert.equal(evaluate({...bank,type:'pos_statement'}).status,'non_tuition_review');
 assert.equal(evaluate({...bank,classification:'merchant_settlement_or_transfer_review'}).status,'exclude_from_student_income');
});
