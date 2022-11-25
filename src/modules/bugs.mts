import { readFileSync } from "fs";
import { v2scrape } from "./v2scrape.mjs";

interface BugsObject {
  sni: Array<string>;
  cdn: Array<string>;
}

class Bugs {
  private _sni: Array<string> = [];
  private _cdn: Array<string> = [];
  private bugs: BugsObject;

  constructor(bugBundle: string) {
    this.bugs = JSON.parse(readFileSync(`${v2scrape.path}/bugs/${bugBundle}.json`).toString());

    this._sni = this.bugs.sni;
    this._cdn = this.bugs.cdn;
  }

  get sni(): string {
    return this._sni[Math.floor(Math.random() * this._sni.length)];
  }

  get cdn(): string {
    return this._cdn[Math.floor(Math.random() * this._cdn.length)];
  }
}

export { Bugs };
