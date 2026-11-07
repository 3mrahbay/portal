import {readFileSync,writeFileSync} from 'node:fs';
export function prepare(source, snippet) {
  const start=source.indexOf('    // Kitap Kulübü:');
  const end=source.indexOf('    // ========== VARSAYILAN', start);
  if(start<0 || end<0 || source.includes('function kkPhoto()'))throw Error('Kulüp kural sınırı değişti veya etkileşim kuralları zaten mevcut.');
  if(!source.slice(end).includes("!(collection in ['kitapKulubu','kitapKulubuUyeler'])"))throw Error('Kulüp varsayılan joker kuraldan dışlanmamış.');
  const block=source.slice(start,end), marker='        allow delete: if false;\n      }\n    }';
  if(block.split(marker).length!==2)throw Error('Paylaşım kural sınırı değişti.');
  const featureStart=snippet.indexOf('        // Photo interactions:');
  const featureEnd=snippet.lastIndexOf('\n      }\n    }');
  if(featureStart<0 || featureEnd<featureStart)throw Error('Etkileşim parçası bulunamadı.');
  const feature=snippet.slice(featureStart,featureEnd);
  return source.slice(0,start)+block.replace(marker,'        allow delete: if false;\n'+feature+'\n      }\n    }')+source.slice(end);
}
if(process.argv[2])writeFileSync(process.argv[3],prepare(readFileSync(process.argv[2],'utf8'),readFileSync(new URL('./kitap-kulubu.rules.snippet',import.meta.url),'utf8')));
