import { AzureFunction, Context } from "@azure/functions";
import axios from "axios";
import * as cheerio from "cheerio";

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
  var timeStamp = new Date().toISOString();

  const response = await axios.get("https://terraria.org/");
  const $ = cheerio.load(response.data);
  const footer = $("div.page-footer > a");
  const dedicated = footer.toArray().filter((my) => $(my).text().includes("PC Dedicated Server"));
  const version_text = $(dedicated).attr("href").split("/").pop();
  console.log(version_text);

  // post slack
  const webhook_url = process.env["SLACK_WEBHOOK_URL"];
  const contents = {
    text: `<!channel> New Terraria Server.
${version_text}
<https://terraria.org/>`,
  };

  await axios.post(webhook_url, JSON.stringify(contents));
};

export default timerTrigger;
