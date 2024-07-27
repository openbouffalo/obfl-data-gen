import fs from 'fs/promises';

export const fileExists = path => new Promise(resolve => fs.access(path, fs.constants.F_OK).then(() => resolve(true)).catch(() => resolve(false)));
