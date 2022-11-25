class Bugs {
  private _sni: Array<string> = ["options.teams.microsoft.com", "imports.teams.microsoft.com"];
  private _cdn: Array<string> = ["main.millionaireaisle.com"];

  get sni(): string {
    return this._sni[Math.floor(Math.random() * this._sni.length)];
  }

  get cdn(): string {
    return this._cdn[Math.floor(Math.random() * this._cdn.length)];
  }
}

const bugs = new Bugs();
export { bugs };
