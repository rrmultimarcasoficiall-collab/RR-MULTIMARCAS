export interface BolaoData {
  pass: string;
  t1: string;
  t2: string;
  badge: string;
  eyebrow: string;
  sub: string;
  ctah: string;
  ctaf: string;
  csub: string;
  tr1: string;
  tr2: string;
  tr3: string;
  foot: string;
  lh: string;
  lf: string;
  wn: string;
  ws: string;
  s1n: string;
  s1l: string;
  s2n: string;
  s2l: string;
  s3n: string;
  s3l: string;
  s4n: string;
  s4l: string;
  st1t: string;
  st1d: string;
  st2t: string;
  st2d: string;
  st3t: string;
  st3d: string;
  st4t: string;
  st4d: string;
  psub: string;
  pnote: string;
  p1v: string;
  p1d: string;
  rules: string[];
  isAuditReady: boolean;
  loginImg: string;
  loginBadge: string;
  loginTitle1: string;
  loginTitle2: string;
  loginSub: string;
  deadline: string;
  isBettingClosed?: boolean;
  isOverrideClosed?: boolean;
  nextRoundTitle?: string;
  nextRoundDate?: string;
  nextRoundTime?: string;
}

export interface Game {
  id: string;
  team1: string;
  team2: string;
  logo1?: string;
  logo2?: string;
  date: string;
  time?: string;
  result: 'win1' | 'draw' | 'win2' | 'pending';
  order: number;
}

export interface Bet {
  id: string;
  userId: string;
  gameId: string;
  prediction: 'win1' | 'draw' | 'win2';
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  displayName: string;
  birthDate?: string;
  phone?: string;
  status: 'pending' | 'approved' | 'rejected';
  betsSubmitted?: boolean;
  paymentStatus?: 'pending' | 'approved' | 'none';
}

export interface Team {
  id: string;
  name: string;
  logo: string;
}

export interface Cartela {
  id: string;
  userId: string;
  userName: string;
  predictions: Record<string, 'win1' | 'draw' | 'win2'>;
  paymentStatus: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  quantity: number;
  totalAmount: number;
}
