## emuled

eMule(eDonkey) Client for Node.js

### Install

```bash
npm install emuled
```

### Usage

```js
import { Client } from "emuled";

const client = new Client();
client.on("connected", (session) => {
  console.log(`connected to ${session.host}:${session.port}`);
  client.login();
});
client.on("idchange", (session) => {
  console.log(`logged in. new id is ${session.clientId}`);
  client.search('search keywords')
});
client.on("serverstatus", (session) => {
  console.log(`server status: users ${session.users}, files ${session.files}`);
});
client.on("servermessage", (session) => {
  console.log('server messages',session.messages);
});
client.on("searchresult", (session) => {
  console.log(search result, session.results);
  client.disconnect()
});
client.on('disconnected', () => {
    console.log('disconnected')
})
client.connect("123.123.123.123", 4567);
```
