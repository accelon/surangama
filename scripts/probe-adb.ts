import { AdbReader, SyncIO } from '../../adb-converter/ts/src/accelon26/adb.ts';

for (const path of ['D:/accelon3/taisho.adb', 'D:/accelon3/wxzj.adb']) {
  const r = await AdbReader.open(new SyncIO(path));
  const c = await r.counters();
  console.log(path, c.db, c.dbcname, c.documents, c.lines, c.virtualLength, c.distinctTokens);
  const docs = await r.documents();
  console.log('docs', docs.length, docs.slice(0, 5));
  const tabs = r.containers.get('tables');
  console.log('tables', tabs?.names.slice(0, 30));
  const tags = r.containers.get('tags');
  console.log('tags', tags?.names.slice(0, 40));
}
