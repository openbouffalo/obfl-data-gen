import YAML from 'yaml';
import fs from 'fs/promises';
import assert from 'assert';

const onlyVerified = false;

class CHeaderGen {
  constructor (periName) {
    this._periName = periName;
    this._regLines = [];
  }
  
  async generateRegisters(peri) {
    this._regLines = [];
    /** @type {Array} */
    let regs = peri.registers;
    if (onlyVerified) {
      regs = regs.filter(reg => reg.verified === true);
    }
    regs.sort((a, b) => a.offset_bytes - b.offset_bytes);
    
    let previousReg = null;
    for (const reg of regs) {
      assert(reg.size_bytes === 0x04); // we do not support other values yet.
      if ((reg.offset_bytes !== 0x0 && previousReg === null) ||
          (previousReg !== null && previousReg.offset_bytes + previousReg.size_bytes !== reg.offset_bytes)) {
        const name = '_rsvd' + (previousReg === null ? 0 : previousReg.offset_bytes + previousReg.size_bytes).toString(16).toUpperCase();
        const length = (reg.offset_bytes - (previousReg?.size_bytes ?? 0) - (previousReg?.offset_bytes ?? 0)) / 4;
        this._regLines.push(`// Reserved`);
        this._regLines.push(`uint32_t ${name}[${length}];`);
      }
      let comments = [];
      if (reg.description != null) comments.push(reg.description);
      comments.push('Offset: 0x' + reg.offset_bytes.toString(16));
      let comment = '// ' + comments.join(', ');
      let regline = `uint32_t ${reg.name};`
      this._regLines.push(comment);
      this._regLines.push(regline);
      previousReg = reg;
    }
    
    let regFileOutput = '';
    const guardMacro = `__PERI_${this._periName.toUpperCase()}_H_`;
    regFileOutput += `#ifndef ${guardMacro}
#define ${guardMacro}

typedef struct {
  ${this._regLines.join('\n  ')}
} ${this._periName}_regs;
 
#endif`

    await fs.writeFile('./c-output/glb.h', regFileOutput);
  }
}



async function main() {
  const peri = YAML.parse(await fs.readFile('../bouffalo-data/bl702/peripherals/glb.yaml', 'utf-8'));
  const cgen = new CHeaderGen('glb');
  await cgen.generateRegisters(peri);
}

main();