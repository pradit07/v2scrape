export interface V2Object {
  vpn: string;
  address: string;
  port: number;
  alterId: number;
  host: string;
  id: string;
  network: string;
  path: string;
  tls: string;
  type: string;
  security: string;
  skipCertVerify: boolean;
  sni: string;
  remark: string;
  cdn?: boolean;
}

export interface Vmess {
  add: string;
  aid: number;
  host: string;
  id: string;
  net: string;
  path: string;
  port: number;
  ps: string;
  tls: string;
  type: string;
  security: string;
  "skip-cert-verify": boolean;
  sni: string;
}

export interface Vless {
  server: string;
  port: number;
  id: string;
  security: string;
  encryption: string;
  headerType: string;
  type: string;
  path: string;
  host: string;
  remark: string;
  sni: string;
}
