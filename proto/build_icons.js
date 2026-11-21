// Gera proto/vendor/icons.js só com os ícones Lucide citados nos fontes (em vez dos ~1.700 do pacote inteiro).
// Uso: node proto/build_icons.js <caminho para lucide/dist/umd/lucide.js>
const fs=require('fs'),path=require('path');
const L=require(path.resolve(process.argv[2]));
const P=s=>s.replace(/(\w)(\w*)(_|-|\s*)/g,(a,b,c)=>b.toUpperCase()+c.toLowerCase());
const src=fs.readdirSync(path.join(__dirname,'src')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(__dirname,'src',f),'utf8')).join('\n');
const used={};
for(const m of src.matchAll(/['"`,]([a-z](?:[a-z0-9-]*[a-z0-9])?)(?=['"`,])/g)){const k=P(m[1]);if(L.icons[k])used[k]=L.icons[k][2]}
const js=`/* Lucide ${'0.460.0'} (ISC) · subconjunto gerado por proto/build_icons.js · ${Object.keys(used).length} ícones */
(function(){var I=${JSON.stringify(used)};
var D={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};
var P=function(s){return s.replace(/(\\w)(\\w*)(_|-|\\s*)/g,function(a,b,c){return b.toUpperCase()+c.toLowerCase()})};
function el(t,a,ch){var e=document.createElementNS("http://www.w3.org/2000/svg",t);for(var k in a)e.setAttribute(k,String(a[k]));(ch||[]).forEach(function(c){e.appendChild(el(c[0],c[1],c[2]))});return e}
function createIcons(){document.querySelectorAll("[data-lucide]").forEach(function(x){var n=x.getAttribute("data-lucide"),ch=I[P(n)];if(!ch)return;var a={};for(var k in D)a[k]=D[k];a["data-lucide"]=n;
 Array.prototype.forEach.call(x.attributes,function(t){a[t.name]=t.value});var cl=["lucide","lucide-"+n].concat((x.getAttribute("class")||"").split(" ")).filter(function(v,i,s){return v&&s.indexOf(v)===i});a["class"]=cl.join(" ");
 x.parentNode&&x.parentNode.replaceChild(el("svg",a,ch),x)})}
window.lucide={createIcons:createIcons};})();
`;
fs.writeFileSync(path.join(__dirname,'vendor','icons.js'),js);console.log('icons',Object.keys(used).length,(js.length/1024).toFixed(1)+'KB');
