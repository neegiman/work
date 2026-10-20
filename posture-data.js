export const POSTURE_GUIDES = {
  plank: {
    id: 'plank', name: '플랭크', subtitle: '팔꿈치로 지지하는 기본 플랭크',
    cues: [
      ['팔꿈치는 어깨 바로 아래', '팔꿈치와 아래팔로 바닥을 지지하세요. 어깨가 귀 쪽으로 올라가지 않게 해주세요.'],
      ['몸통과 다리를 일직선으로', '복부에 힘을 주고 엉덩이가 처지거나 지나치게 들리지 않도록 유지하세요.'],
      ['목은 편안하게, 호흡은 자연스럽게', '고개를 치켜들지 않고 바닥을 보며, 숨을 참지 않고 자세를 유지하세요.'],
    ],
    source: { name: 'ACE · Front Plank', url: 'https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/' },
  },
  pushup: {
    id: 'pushup', name: '팔굽혀펴기', subtitle: '몸의 정렬을 유지하며 천천히 내려갔다 올라오기',
    cues: [
      ['손은 어깨너비보다 약간 넓게', '손바닥으로 바닥을 지지하고, 시작할 때 어깨가 손 위에 오도록 준비하세요.'],
      ['머리부터 발뒤꿈치까지 일직선', '복부에 힘을 주고, 허리나 엉덩이만 먼저 내려가지 않도록 함께 움직이세요.'],
      ['팔꿈치를 굽혀 몸 전체를 낮추기', '팔꿈치는 몸통에서 약 45도 방향으로 굽히며 천천히 내려갔다 밀어 올리세요.'],
    ],
    source: { name: 'NASM · Push-Up', url: 'https://www.nasm.org/resource-center/exercise-library/push-up' },
  },
};

const add = (a, b) => a.map((value, i) => value + b[i]);
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const scale = (a, amount) => a.map(value => value * amount);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const length = a => Math.hypot(...a);
const unit = a => scale(a, 1 / Math.max(length(a), 0.00001));

function elbowBetween(shoulder, wrist, side) {
  const direction = unit(subtract(wrist, shoulder));
  const distance = length(subtract(wrist, shoulder));
  const upper = 0.34, lower = 0.33;
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const reach = Math.sqrt(Math.max(0, upper * upper - along * along));
  const hint = [-1, 0.15, side * 0.7];
  const bend = unit(subtract(hint, scale(direction, dot(hint, direction))));
  return add(add(shoulder, scale(direction, along)), scale(bend, reach));
}

export function getPosture(exercise, depth = 0) {
  if (!POSTURE_GUIDES[exercise]) throw new RangeError('Unknown posture');
  const amount = Math.max(0, Math.min(1, Number(depth) || 0));
  const angle = exercise === 'plank' ? Math.asin(0.27 / 1.8) : 0.33 + (0.055 - 0.33) * amount;
  const direction = [Math.cos(angle), Math.sin(angle), 0];
  const ankle = [-1.22, 0.18, 0];
  const hip = add(ankle, scale(direction, 0.96));
  const shoulder = add(ankle, scale(direction, 1.8));
  const head = add(shoulder, scale(direction, 0.37));
  const sides = [-1, 1].map(side => {
    const shoulderJoint = add(shoulder, [0, 0, side * 0.25]);
    const wrist = exercise === 'plank'
      ? [shoulder[0] + 0.33, 0.11, side * 0.25]
      : [0.53, 0.115, side * 0.34];
    const elbow = exercise === 'plank' ? [shoulder[0], 0.11, side * 0.25] : elbowBetween(shoulderJoint, wrist, side);
    return {
      shoulder: shoulderJoint, elbow, wrist, hand: add(wrist, [0.095, -0.035, 0]),
      hip: add(hip, [0, 0, side * 0.15]),
      knee: add(add(ankle, scale(direction, 0.49)), [0, 0, side * 0.145]),
      ankle: add(ankle, [0, 0, side * 0.14]),
      toe: [-1.12, 0.075, side * 0.14],
    };
  });
  const near = sides[1];
  return {
    direction, hip, shoulder, head, sides,
    markers: exercise === 'plank'
      ? [add(near.elbow, [0, 0.02, 0.12]), add(hip, [-0.05, 0.22, 0.2]), add(head, [0.05, 0.21, 0.02])]
      : [add(near.wrist, [0.02, 0.02, 0.13]), add(hip, [-0.05, 0.22, 0.2]), add(near.elbow, [-0.02, 0.12, 0.1])],
  };
}
