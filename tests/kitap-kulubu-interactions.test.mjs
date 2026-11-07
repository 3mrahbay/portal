import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReply,createInteractionsStore} from '../js/kitap-kulubu/interactions-store.mjs';
test('reply bounds and Unicode',()=>{assert.equal(validateReply(' 🌸 '),'🌸');for(const value of ['', '  ', 'a'.repeat(501)])assert.throws(()=>validateReply(value));assert.equal(validateReply('a'.repeat(500)).length,500);});
test('retry uses the same reply id and cannot overwrite another author',async()=>{
 let value=null,writes=0;
 const fb={doc:(_db,...p)=>p.join('/'),serverTimestamp:()=>123,runTransaction:async(_db,fn)=>fn({get:async()=>({exists:()=>!!value,data:()=>value}),set:(_ref,v)=>{value=v;writes++}})};
 const store=createInteractionsStore(fb,{}, {currentUser:{uid:'a',displayName:'Anne'}});
 await store.reply('b','p','r','merhaba');await store.reply('b','p','r','merhaba');assert.equal(writes,1);
 value.authorUid='other';await assert.rejects(store.reply('b','p','r','merhaba'));
});
