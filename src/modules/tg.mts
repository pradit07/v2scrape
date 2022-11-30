import { readFileSync } from "fs";
import { Bot as TgBot, InlineKeyboard } from "grammy";
import { Country, Region, V2Object } from "./types.mjs";
import { v2scrape } from "./v2scrape.mjs";
import { countryCodeEmoji } from "country-code-emoji";

class Bot {
  bot = new TgBot(readFileSync("./bot_token").toString());

  private async make(region: Region) {
    const result: Array<V2Object> = JSON.parse(readFileSync("./result/result.json").toString());
    const countries: Array<Country> = JSON.parse(readFileSync("./countries.json").toString());
    const account: V2Object = await (async () => {
      for (const account of result) {
        if (account.cc) {
          for (const country of countries) {
            if (account.cc == country.code) {
              if (country.region == region) {
                const isConnected = await v2scrape.test(account, 10203, "sni");
                if (isConnected.error) continue;
                return {
                  ...isConnected,
                  countryName: country.name,
                };
              }
            }
          }
        }
      }

      return { error: "Account not found!" } as V2Object;
    })();

    if (account.error) {
      return console.log(account.error);
    }

    let message: string = "---------------------------\n";
    message += "Akun Gratis | Free Accounts\n";
    message += "---------------------------\n";
    message += `Jumlah/Count: ${result.length} 🌾\n`;
    message += `Regional/Region: ${account.countryName} ${countryCodeEmoji(account.cc as string)}\n`;
    message += "---------------------------\n";
    message += "Info:\n";
    message += `Remark: <code>${account.remark}</code>\n`;
    message += `Address: <code>${account.address}</code>\n`;
    message += `Port: <code>${account.port}</code>\n`;
    message += `Network: <code>${account.network}</code>\n`;
    message += `Host: <code>${account.host}</code>\n`;
    message += `Path: <code>${account.path}</code>\n`;
    message += `TLS: <code>${account.tls ? true : false}</code>\n`;
    message += `SNI: <code>${account.sni}</code>\n\n`;
    message += `⌜<code>${v2scrape.toBase64(account, account.sni, account.address)}</code>⌟\n\n`;
    message += `Config: <a href="https://github.com/dickymuliafiqri/v2scrape/tree/master/config">Config Example</a>\n`;
    message += `Sub: <a href="https://github.com/dickymuliafiqri/v2scrape/tree/master/result">Subscription</a>\n`;
    message += `Join: @v2scrape\n\n`;
    message += `Contact: @d_fordlalatina`;

    return message;
  }

  async send(region: Region = "Asia") {
    const message = await this.make(region);
    if (!message) return;

    await this.bot.api.sendMessage("732796378", message, {
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
