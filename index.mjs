import {Deta} from "deta"
import fetch from "node-fetch"
import Twitter from "twitterspace"
import cron from "node-cron"
import dotenv from "dotenv"
dotenv.config()
const deta = Deta(process.env.detaToken)
const accountDB = deta.Base("account")
const spaceDB = deta.Base("space")
const twitter = new Twitter()
twitter.getGuestId()
let latest = (new Date()).getTime()

async function announce(id){
  let now = new Date()
  let expire = new Date()
  expire.setHours(now.getHours()-1)
  if(expire.getTime() > latest){
    await twitter.getGuestId()
    latest = now.getTime()
  }
  const spaceInfo = await twitter.getSpaceInfo(id)
  const metadata = spaceInfo.audioSpace.metadata
  let discordres = await fetch(process.env.discordURL,{
    method: "POST",
    headers:{
      "content-type":"application/json"
    },
    body: JSON.stringify({
      username: "Hololive Space開始通知",
      content: `${metadata.creator_results.result.legacy.name}さんがスペースを開始しました。\rタイトル：${metadata.title}\rhttps://twitter.com/i/spaces/${id}`,
      avatar_url: "https://space-dl.ml/img/favicon.png"
    })
  })
  if(!discordres.ok) res.status(500).send()
  spaceDB.put({
    key: id,
    status: "announced"
  })
}

async function checkAndAnnounce(){
  let accounts = (await accountDB.fetch()).items
  let ids = []
  for(let account of accounts){
    ids.push(account.key)
  }

  let res = await fetch(`https://api.twitter.com/2/spaces/by/creator_ids?user_ids=${ids.join(",")}`,{
    headers:{
      "authorization": `Bearer ${process.env.twitterBearerToken}`
    }
  })
  if(!res.ok) {
    res = await res.json()
    console.log(res)
    throw new Error("Server returned not 200")
  }
  res = await res.json()
  ids = []
  if(res.meta.result_count){
    for(let space of res.data){
      if(space.state == "live"){
          ids.push(space.id)
      }
    }
  }
  for(let id of ids){
    let announced = await spaceDB.get(id)
    if(announced) continue
    announce(id)
  }
}

cron.schedule('* * * * *', () => {
  checkAndAnnounce()
})