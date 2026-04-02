import crypto from 'crypto';

const CHURCH_ID = process.argv[2];
if (!CHURCH_ID) { console.error('church_id를 인자로 넣어주세요'); process.exit(1); }

const KEY = Buffer.from('a53b038398bb76e62e519afcfcab704f51bc5bd9b3e39d50017738e2a15ebc6a', 'hex');

function encryptRRN(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function birthdate(rrn) {
  const digits = rrn.replace('-', '');
  const yy = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const dd = digits.slice(4, 6);
  const g  = parseInt(digits[6]);
  const year = (g === 1 || g === 2) ? `19${yy}` : `20${yy}`;
  return `${year}-${mm}-${dd}`;
}

const members = [
  { name: '전다희', rrn: '910925-2067024', memo: '김연우맘' },
  { name: '홍설운', rrn: '760130-2637819', memo: '정현민맘' },
  { name: '정선',   rrn: '700719-2655418', memo: '선유안맘' },
  { name: '김영운', rrn: '560330-2475748', memo: '오시우할마' },
  { name: '윤정인', rrn: '801122-2066915', memo: '신재용맘' },
  { name: '안혜연', rrn: '720903-2064011', memo: '윤상연맘' },
  { name: '김형숙', rrn: '500830-2047125', memo: '황은영맘' },
  { name: '김흥구', rrn: '691208-1721315', memo: '김성현아빠' },
];

const lines = members.map(m => {
  const enc = encryptRRN(m.rrn);
  const bd  = birthdate(m.rrn);
  return `  ('${crypto.randomUUID()}', '${CHURCH_ID}', 'parent', '${m.name}', NULL, '${bd}', '${enc}', NULL, '${m.memo}', NOW(), NOW())`;
});

console.log('INSERT INTO members (id, church_id, type, name, photo_url, birthdate, rrn_encrypted, phone, memo, created_at, updated_at) VALUES');
console.log(lines.join(',\n') + ';');
