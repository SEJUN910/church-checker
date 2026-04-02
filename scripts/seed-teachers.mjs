// 실행: node scripts/seed-teachers.mjs <church_id>
// 예시: node scripts/seed-teachers.mjs xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
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

// 주민번호 앞 6자리 → YYYY-MM-DD
function birthdate(rrn) {
  const [yy, mm, dd] = [rrn.slice(0,2), rrn.slice(2,4), rrn.slice(4,6)];
  const genderDigit = parseInt(rrn[7]); // '-' 제외 인덱스
  const century = genderDigit <= 2 ? '19' : genderDigit <= 4 ? '19' : '20';
  // 1,2 → 1900s, 3,4 → 2000s (간단 처리: 47년생 등 고려)
  const year = parseInt(yy) >= 0 && parseInt(yy) <= 24 && genderDigit >= 3 ? `20${yy}` : `19${yy}`;
  return `${year}-${mm}-${dd}`;
}

const members = [
  { name: '김영란', rrn: '630726-2573319', phone: '010-2218-2375', memo: '부장' },
  { name: '황현수', rrn: '770512-2808924', phone: null, memo: null },
  { name: '장경순', rrn: '721030-1067026', phone: '010-9990-4991', memo: null },
  { name: '이정미', rrn: '990323-2052717', phone: null, memo: null },
  { name: '강명희', rrn: '470101-2067014', phone: null, memo: null },
  { name: '이종훈', rrn: '750504-1639218', phone: null, memo: null },
  { name: '박상민', rrn: '871204-1590811', phone: '010-3536-9431', memo: null },
  { name: '김준호', rrn: '930901-1164225', phone: null, memo: null },
  { name: '박애순', rrn: '611208-2646716', phone: null, memo: null },
  { name: '김수정', rrn: '841027-2041225', phone: '010-8886-7325', memo: '부감,회계' },
  { name: '이주성', rrn: '900212-1157420', phone: null, memo: null },
  { name: '최근예', rrn: '571017-2055615', phone: null, memo: null },
  { name: '김택중', rrn: '601220-1801016', phone: null, memo: null },
  { name: '안윤희', rrn: '860305-2273621', phone: null, memo: null },
  { name: '김병문', rrn: '770408-1535317', phone: null, memo: null },
  { name: '권효선', rrn: '891120-2012411', phone: null, memo: null },
  { name: '한종필', rrn: '710223-1464511', phone: '010-2016-4025', memo: null },
  { name: '이상화', rrn: '960709-1113622', phone: null, memo: null },
  { name: '허미자', rrn: '620410-2666021', phone: null, memo: null },
  { name: '김옥자', rrn: '700716-2722615', phone: null, memo: null },
  { name: '임광빈', rrn: '790110-1380348', phone: '010-6623-7332', memo: '목사' },
];

const lines = members.map(m => {
  const encrypted = encryptRRN(m.rrn); // 대시 포함
  const bd = birthdate(m.rrn.replace('-', ''));
  const phone = m.phone ? `'${m.phone}'` : 'NULL';
  const memo  = m.memo  ? `'${m.memo}'`  : 'NULL';
  return `  ('${crypto.randomUUID()}', '${CHURCH_ID}', 'teacher', '${m.name}', NULL, '${bd}', '${encrypted}', ${phone}, ${memo}, NOW(), NOW())`;
});

// UPDATE 쿼리 (기존 레코드 rrn_encrypted만 갱신)
const updates = members.map(m => {
  const encrypted = encryptRRN(m.rrn);
  return `UPDATE members SET rrn_encrypted = '${encrypted}' WHERE church_id = '${CHURCH_ID}' AND name = '${m.name}' AND type = 'teacher';`;
});

console.log('-- ▼ UPDATE 쿼리 (기존 레코드 RRN 대시 포함으로 업데이트)');
console.log(updates.join('\n'));
