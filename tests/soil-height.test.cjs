// Run with: node tests/soil-height.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        let soilDraftDirty = false;');
const end = html.indexOf('        // --- 4. Map & Markers ---', start);
assert.ok(start >= 0 && end > start);
function element() {
    return { value: 40, children: [], listeners: {}, attributes: {}, dataset: {}, classList: {add(){},remove(){}},
        setAttribute(k,v){this.attributes[k]=v}, scrollTo({top}){this.scrollTop=top},
        appendChild(x){this.children.push(x)}, replaceChildren(...x){this.children=x},
        addEventListener(k,f){this.listeners[k]=f} };
}
const elements = Object.fromEntries(['picker-soil','user-soil-height','btn-set-soil-height'].map(x=>[x,element()]));
const storage = new Map();
const sent = [], timers = new Map();
let timerId=0;
const context = vm.createContext({
    document: {getElementById: id=>elements[id], createElement: element, addEventListener(){}, activeElement:null},
    localStorage: {getItem:k=>storage.get(k), setItem:(k,v)=>storage.set(k,v)},
    performance:{now:()=>10000}, PICKER_ITEM_HEIGHT:44, createPickerSpacer:element,
    renderPickerItems(){}, ros:{isConnected:true}, showToast(){}, t:x=>x,
    ROSLIB:{Message:function(x){Object.assign(this,x)}},soilHeightPub:{publish:x=>sent.push(x)},
    setTimeout:f=>{timers.set(++timerId,f);return timerId},clearTimeout:id=>timers.delete(id),
});
vm.runInContext(html.slice(start,end),context);
context.initSoilPicker();
assert.equal(elements['picker-soil'].children.length,53); // 51 values + 2 spacers
assert.equal(elements['user-soil-height'].value,40);
context.onSoilHeightActual({data:12});
assert.equal(elements['user-soil-height'].value,12);
context.selectSoilInPicker(0,true);
context.onSoilHeightActual({data:40});
assert.equal(elements['user-soil-height'].value,0,'hardware refresh must not overwrite a draft');
context.applySoilHeightSetting();
assert.equal(sent.at(-1).data,0);
assert.equal(elements['btn-set-soil-height'].disabled,true);
context.onSoilHeightActual({data:40});
assert.equal(elements['btn-set-soil-height'].disabled,true,'wrong echo must not confirm');
context.onSoilHeightActual({data:0});
assert.equal(elements['btn-set-soil-height'].textContent,'OK');
assert.equal(storage.get('tractor-soil-height-mm'),'0');
context.selectSoilInPicker(50,true);
context.applySoilHeightSetting();
assert.equal(sent.at(-1).data,50);
context.onSoilHeightActual({data:50});
assert.equal(elements['btn-set-soil-height'].textContent,'OK');
context.selectSoilInPicker(100,true);
assert.equal(elements['user-soil-height'].value,50);
context.selectSoilInPicker(-2,true);
assert.equal(elements['user-soil-height'].value,0);
context.selectSoilInPicker(23,true);
context.applySoilHeightSetting();
[...timers.values()][0]();
assert.equal(elements['btn-set-soil-height'].textContent,'ERR','missing hardware ack must time out');
context.ros.isConnected=false;
const before=sent.length;
context.applySoilHeightSetting();
assert.equal(sent.length,before);
const key=elements['picker-soil'].listeners.keydown;
key({key:'End',preventDefault(){}});
assert.equal(elements['user-soil-height'].value,50);
key({key:'Home',preventDefault(){}});
assert.equal(elements['user-soil-height'].value,0);
console.log('PASS: soil wheel 0..50, draft protection, hardware echo, persistence, timeout, keyboard and offline handling');
