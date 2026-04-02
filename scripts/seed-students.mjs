// 실행: node scripts/seed-students.mjs <church_id>
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

function memo(disability, medicine) {
  if (disability === '없음' && medicine === '없음') return 'NULL';
  return `E'장애등급: ${disability}\\n복용약: ${medicine}'`;
}

const members = [
  { name: '전다영', rrn: '920917-2067019', disability: '모름',           medicine: '모름' },
  { name: '김연우', rrn: '190427-3074811', disability: '자폐성 장애 (중증)', medicine: '아빌리파이정 복용' },
  { name: '선유안', rrn: '001017-3067918', disability: '자폐성 장애',     medicine: '없음' },
  { name: '박민성', rrn: '090917-3067019', disability: '없음',           medicine: '없음' },
  { name: '정현민', rrn: '040513-3067016', disability: '지적장애 1급',    medicine: '없음' },
  { name: '김보민', rrn: '921005-2069713', disability: '자폐성 장애 1급', medicine: '과민성 약(아빌리파이)' },
  { name: '이수진', rrn: '010509-4066914', disability: '지적장애 3급',    medicine: '없음' },
  { name: '남가희', rrn: '010801-4069711', disability: '지적장애 3급',    medicine: '없음' },
  { name: '박소영', rrn: '010816-4067719', disability: '지적장애 3급',    medicine: '없음' },
  { name: '박예빈', rrn: '000131-4069516', disability: '지적장애 3급',    medicine: '없음' },
  { name: '조민서', rrn: '971009-2069735', disability: '자폐성 장애 1급', medicine: '없음' },
  { name: '정유빈', rrn: '010513-3069713', disability: '없음',           medicine: '없음' },
  { name: '오시우', rrn: '150318-3083016', disability: '없음',           medicine: '없음' },
  { name: '박지열', rrn: '891006-1069215', disability: '지적장애 1급',    medicine: '신경과 약' },
  { name: '박지웅', rrn: '050211-3229320', disability: '뇌병변 중증장애', medicine: '없음' },
  { name: '신재용', rrn: '150921-3068915', disability: '모름',           medicine: '모름' },
  { name: '윤상연', rrn: '040814-3226917', disability: '자폐, 인지장애 1급', medicine: '없음' },
  { name: '문보경', rrn: '010222-3067019', disability: '장애중증',        medicine: '정신과약,혈압약' },
  { name: '임세빈', rrn: '000124-4300417', disability: '다운증후군',      medicine: '없음' },
  { name: '김태훈', rrn: '980303-1069722', disability: '지적발달장애 1급', medicine: '콘서타' },
  { name: '김명철', rrn: '940912-1104125', disability: '장애중증',        medicine: '없음' },
  { name: '정유진', rrn: '010701-4658913', disability: '없음',           medicine: '없음' },
  { name: '황은영', rrn: '830317-2696029', disability: '지적장애',        medicine: '없음' },
  { name: '이자빈', rrn: '010108-4067019', disability: '장애중증',        medicine: '없음' },
  { name: '김성현', rrn: '980224-1054538', disability: '자폐성 장애',     medicine: '경기 약' },
  { name: '김성년', rrn: '980103-1068927', disability: '지체, 지적장애 1급', medicine: '없음' },
];

const lines = members.map(m => {
  const enc = encryptRRN(m.rrn);
  const bd  = birthdate(m.rrn);
  const mem = memo(m.disability, m.medicine);
  return `  ('${crypto.randomUUID()}', '${CHURCH_ID}', 'student', '${m.name}', NULL, '${bd}', '${enc}', NULL, ${mem}, NOW(), NOW())`;
});

console.log('INSERT INTO members (id, church_id, type, name, photo_url, birthdate, rrn_encrypted, phone, memo, created_at, updated_at) VALUES');
console.log(lines.join(',\n') + ';');
