import YAML from 'yaml';
import fs from 'fs/promises';
import {XMLBuilder, XMLParser} from 'fast-xml-parser';
import path from 'path';
import { fileExists } from './utils.js';
import assert from 'assert';

const numToHex = (num, pad = 8) => '0x' + num.toString(16).toUpperCase().padStart(pad, 0);

export default class Yaml2SvdGenerator {
  constructor (chipFolder) {
    this._chipFolder = chipFolder;
    this._svd = null;
    this._chipInfo = null;
  
    this._xmlbuilder = new XMLBuilder({
      processEntities: true,
      format: true,
      ignoreAttributes: false,

      // commentPropName: "phone"
    }); 
  }

  async _genDeviceBlock() {
    const chip = this._chipInfo;
    const device = {
      "@_schemaVersion": "1.1",
      "@_xmlns:xs": "http://www.w3.org/2001/XMLSchema-instance",
      "@_xs:noNamespaceSchemaLocation": "CMSIS-SVD.xsd",
      vendor: 'Bouffalo Lab',
      vendorid: 'bouffalolab',
      name: chip.name,
      version: '0.1', // TODO:
      description: 'To be added', // TODO: This is required
      // TODO: License text!!
      // TODO: CPU, not required, but might be good
      addressUnitBits: 8,
      width: 32,
      size: 32,
      access: 'read-write',
      resetValue: '0x00000000',
      resetMask: '0xFFFFFFFF',
      peripherals: {
        peripheral: []
      }
    };

    this._svd.device = device;

    this._derivedFromTable = {};
    this._periInfoCache = {};
  }

  async _genRegistersBlock(chipPeri, periBlock) {
    let periInfo = this._periInfoCache[chipPeri.peripheral];
    if (periInfo === undefined) {
      const regFileNames = [ `${chipPeri.peripheral}.yaml`, `${chipPeri.peripheral}_reg.yaml` ];
      periInfo = null;
      this._periInfoCache[chipPeri.peripheral] = null;
      for (const regFileName of regFileNames) {
        const periInfoPath = path.join(this._chipFolder, 'peripherals', regFileName);
        if (await fileExists(periInfoPath)) {
          periInfo = YAML.parse(await fs.readFile(periInfoPath, 'utf8'));
          this._periInfoCache[chipPeri.peripheral] = periInfo;
          break;
        }
      }
    }
    if (periInfo === null) return null;
    const registers = [];

    for (const register of periInfo.registers) {
      const reg = {
        name: register.name, // TODO: uppercase???
        description: register.description !== '' ? register.description : undefined,
        addressOffset: numToHex(register.offset_bytes, 2),
        size: register.size_bytes * 8,
      };

      if (register.fieldset !== undefined) {
        const fields = [];
        const fieldset = periInfo.fieldsets.find(f => f.name === register.fieldset);
        assert(fieldset != undefined);
        const regFields = fieldset.fields;
        for (const regField of regFields) {
          let access = undefined;
          switch (regField.access) {
            case 'rsvd': access = 'read-only'; break;
            case 'r': access = 'read-only'; break;
            case 'w': access = 'write-only'; break;
            case 'r/w': access = 'read-write'; break;
            case 'rw': access = 'read-write'; break;
            case 'w1c': case 'w1p': case 'otp': /* TODO: */ break;
            default: {
              if (regField.access != undefined) {
                console.log(`Unknown access ${regField.access}`);
              }
            }
          }
          const field = {
            name: regField.name, // TODO: uppercase???
            description: regField.description !== '' ? regField.description : undefined,
            bitOffset: regField.offset_bits,
            bitWidth: regField.size_bits,
            access: access, // TODO: better access with modifiedWriteValues and readAction
            // TODO: enumeratedValues	
          };
          fields.push(field);
        }

        reg.fields = {
          field: fields
        };
      }

      // TODO: Implement derived from???
      registers.push(reg);
    }

    return registers;
  }

  async _genPeripheralBlock(chipPeri) {
    const peripherals = this._svd.device.peripherals.peripheral;

    const name = chipPeri.name.toUpperCase();
    const peripheral = chipPeri.peripheral?.toUpperCase();

    // TODO: There can be multiple address blocks.
    let addressBlock = chipPeri.size != undefined ? {
      offset: 0, // TODO: Figure out how this works
      size: numToHex(chipPeri.size), // TODO: We can get real real size from reg yaml file
      usage: 'registers' // TODO: Use this appropriately
    } : undefined;

    const block = {
      name: name,
      description: chipPeri.description !== '' ? chipPeri.description : undefined,
      groupName: peripheral,
      baseAddress: numToHex(chipPeri.address),
      addressBlock: addressBlock,
      registers: undefined,
    };

    const derivedFrom = this._derivedFromTable[peripheral];
    if (peripheral != undefined) {
      if (derivedFrom === undefined) {
        this._derivedFromTable[peripheral] = block.name;
      } else {
        block["@_derivedFrom"] = derivedFrom;
        block.addressBlock = undefined;
      }
    }

    const registerBlocks = await this._genRegistersBlock(chipPeri, block);
    if (registerBlocks !== null) {
      block.registers = {
        register: registerBlocks
      };
    }

    peripherals.push(block);
  }

  async generateFor(chipName, svdPath) {
    this._svd = {
      "?xml": {
          "@_version": "1.0",
          "@_encoding": "utf-8"
      }
    };

    this._chipInfo = YAML.parse(await fs.readFile(path.join(this._chipFolder, 'chips', `${chipName}.yaml`), 'utf8'));

    await this._genDeviceBlock();

    for (const peripheral of this._chipInfo.peripherals) {
      await this._genPeripheralBlock(peripheral);
    }

    const svdContent = this._xmlbuilder.build(this._svd);
    await fs.writeFile(svdPath, svdContent);

    // cleanup
    this._svd = null;
  }
}