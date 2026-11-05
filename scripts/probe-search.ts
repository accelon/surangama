import { AdbReader, SyncIO } from '../../adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from '../../adb-converter/ts/src/accelon26/search.ts';

const r = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(r);
await s.init();

const tagVa = async (tag: string) => {
  const c = r.containers.get('tags')!;
  const at = c.names.indexOf(tag);
  return at >= 0 ? await r.decodeBlockList('tags', at) : [];
};
const pv = Int32Array.from(await tagVa('頁'));
const pids = (await r.attributeValues('頁.id'))?.values ?? [];
const bv = Int32Array.from(await tagVa('書'));
const bnames = (await r.cachedStrings('書')) ?? (await r.attributeValues('書.n'))?.values ?? [];
const at = (arr: Int32Array, va: number) => { let lo=0, hi=arr.length-1, k=-1; while(lo<=hi){const m=(lo+hi)>>1; if(arr[m]<=va){k=m;lo=m+1}else hi=m-1;} return k; };
console.log('pages', pv.length, pids.slice(0,3), 'books', bv.length, bnames.slice(0,5));

for (const q of ['大佛頂如來密因修證了義','首楞嚴','如來密因修證了義']) {
  const res = await s.searchPhrase(q, 10);
  console.log('QUERY', q, 'hits', res.hits.length, 'missing', res.missing, 'ms', res.ms);
  for (const h of res.hits.slice(0,5)) {
    const pi = at(pv,h.va), bi = at(bv,h.va);
    console.log(h.va, 'page', pids[pi], 'book', bnames[bi], 'units', h.units);
  }
}
