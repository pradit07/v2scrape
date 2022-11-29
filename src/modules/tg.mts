import { readFileSync } from "fs";
import { Bot as TgBot, InlineKeyboard } from "grammy";
import { Vmess } from "./types.mjs";

class Bot {
  bot = new TgBot(readFileSync("./bot_token").toString());

  private make(accounts: Array<string>) {
    const vpn: string = accounts[Math.floor(Math.random() * accounts.length)];
    const account: Vmess = JSON.parse(Buffer.from(vpn.replace(/^.+:\/\//, ""), "base64").toString()) as Vmess;
    let message: string = "---------------------------\n";
    message += "Akun Gratis | Free Accounts\n";
    message += "---------------------------\n";
    message += `Jumlah/Count: ${accounts.length} 🌾\n`;
    message += "Regional/Region: World Wide/Seluruh Dunia 🌓\n";
    message += "---------------------------\n";
    message += "Info:\n";
    message += `Remark: <code>${account.ps}</code>\n`;
    message += `Address: <code>${account.add}</code>\n`;
    message += `Port: <code>${account.port}</code>\n`;
    message += `Network: <code>${account.net}</code>\n`;
    message += `Host: <code>${account.host}</code>\n`;
    message += `Path: <code>${account.path}</code>\n`;
    message += `TLS: <code>${account.tls ? true : false}</code>\n`;
    message += `SNI: <code>${account.sni}</code>\n\n`;
    message += `⌜<code>${vpn}</code>⌟\n\n`;
    message += `Config: <a href="https://github.com/dickymuliafiqri/v2scrape/tree/master/config">Config Example</a>\n`;
    message += `Sub: <a href="https://github.com/dickymuliafiqri/v2scrape/tree/master/result">Subscription</a>\n`;
    message += `Join: @v2scrape\n\n`;
    message += `Contact: @d_fordlalatina`;

    return message;
  }

  async send(accounts: Array<string>) {
    const message = this.make(accounts);

    await this.bot.api.sendMessage("-1001509827144", message, {
      disable_web_page_preview: true,
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .url("❤️ Donate ❤️", "https://saweria.co/m0qa")
        .row()
        .url("Donators", "https://telegra.ph/Donations-11-05-4")
        .row(),
    });
  }
}

const bot = new Bot();
export { bot };
