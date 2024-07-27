
import Yaml2SvdGenerator from './yaml2svdgen.js';



async function main() {
  const gen = new Yaml2SvdGenerator('../bouffalo-vendor-data/bl702');
  await gen.generateFor('bl702', 'bl702.svd');
}

main();