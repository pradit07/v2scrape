import { readFileSync } from "fs";
import { Bot as TgBot, InlineKeyboard } from "grammy";

class Bot {
  bot = new TgBot(readFileSync("./bot_token").toString());

  private make(accounts: Array<string>) {
    let message: string = "Akun Gratis | Free Accounts:\n\n";
    message += `<code>${accounts[Math.floor(Math.random() * accounts.length)]}</code>\n\n`;
    message += `Config: <a href="https://github.com/dickymuliafiqri/v2scrape/tree/master/config">Config Example</a>\n`;
    message += `Sub: <a href="https://github.com/dickymuliafiqri/v2scrape/tree/master/result">Subscription</a>\n`;
    message += `Join: @v2scrape\n\n`;
    message += `Contact: @d_fordlalatina`;

    return message;
  }

  async send(accounts: Array<string>) {
    const message = this.make(accounts);

    await this.bot.api.sendMessage("-1001509827144", message, {
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
