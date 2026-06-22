# Local Research Agent 閮ㄧ讲鎸囧崡

杩欎唤鏂囨。璇存槑濡備綍鎶婂綋鍓嶈蒋浠跺鍒跺埌鍙︿竴鍙扮數鑴戜笂杩愯銆傞」鐩槸绾?Node.js 鏈湴缃戦〉鏈嶅姟锛屼笉闇€瑕佹暟鎹簱锛屼篃涓嶄緷璧?npm 绗笁鏂瑰寘銆?
## 1. 鍑嗗鐜

鐩爣鐢佃剳闇€瑕侊細

- Node.js 18 鎴栨洿楂樼増鏈紝寤鸿 Node.js 20 LTS銆?- 鑳借闂綘閫夋嫨鐨勫ぇ妯″瀷 API锛屼緥濡?DeepSeek銆丟emini銆丱penAI-compatible 鏈嶅姟銆?- 濡傛灉浣跨敤 DuckDuckGo HTML 鎼滅储锛岄渶瑕佽兘璁块棶 DuckDuckGo銆?- 濡傛灉浣跨敤 Serper銆乀avily锛岄渶瑕佸搴?API Key銆?
妫€鏌?Node.js锛?
```bash
node -v
npm -v
```

濡傛灉娌℃湁瀹夎 Node.js锛屽埌 https://nodejs.org/ 涓嬭浇 LTS 鐗堟湰銆?
## 2. 鎷疯礉椤圭洰

鎶婃暣涓?`Research Agent` 鏂囦欢澶瑰鍒跺埌鍙︿竴鍙扮數鑴戯紝渚嬪锛?
```text
Research Agent/
  package.json
  server.js
  README.md
  DEPLOYMENT.md
  public/
    index.html
    app.js
    styles.css
```

鍥犱负椤圭洰娌℃湁绗笁鏂?npm 渚濊禆锛岄€氬父涓嶉渶瑕佽繍琛?`npm install`銆?
## 3. 鍚姩鏈嶅姟

杩涘叆椤圭洰鐩綍锛?
```bash
cd Research Agent
npm start
```

鐪嬪埌绫讳技杈撳嚭鍗冲彲锛?
```text
Local Research Agent is running at http://localhost:5173
```

娴忚鍣ㄦ墦寮€锛?
```text
http://localhost:5173
```

## 3A. 浣跨敤鍥惧舰鍚姩鍣?
濡傛灉浣犳嬁鍒扮殑鏄凡缁忔墦鍖呭ソ鐨勫垎鍙戠洰褰曟垨鍘嬬缉鍖咃紝浼樺厛浣跨敤鍥惧舰鍚姩鍣細

- 鍚姩鍣ㄨ矾寰勶細`LocalResearchAgentLauncher.exe`
- 鍘嬬缉鍖呰矾寰勶細`LocalResearchAgent-win-x64.zip`

鍙屽嚮 `LocalResearchAgentLauncher.exe` 鍚庝細鍑虹幇涓€涓皬绐楀彛锛岄噷闈㈡湁锛?
- `Start Service`
- `Open App`
- `Stop Service`

杩欑増鍚姩鍣ㄤ細浼樺厛浣跨敤鍒嗗彂鍖呭唴闄勫甫鐨?`runtime/node.exe`锛屾墍浠ョ洰鏍囩數鑴戦€氬父涓嶉渶瑕佸彟瑁?Node.js銆?
## 4. 閰嶇疆妯″瀷

鎵撳紑椤甸潰鍙充笂瑙掕缃寜閽紝鍙互閰嶇疆锛?
- 棰勮妯″瀷锛欴eepSeek v4 Flash銆丏eepSeek v4 Pro銆丟emini Pro/Flash銆丱penAI compatible銆丆ustom銆?- Base URL锛歄penAI-compatible API 鍦板潃銆?- Model锛氭ā鍨嬪悕銆?- API Key锛氭ā鍨嬫湇鍔″瘑閽ャ€?
甯哥敤绀轰緥锛?
### DeepSeek

```text
Base URL: https://api.deepseek.com/v1
Model: deepseek-v4-flash
```

鎴栵細

```text
Model: deepseek-v4-pro
```

### Gemini OpenAI-compatible

```text
Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
Model: gemini-3.1-pro
```

鎴栵細

```text
Model: gemini-3.5-flash
```

濡傛灉浣犵殑璐﹀彿鎴栧湴鍖哄彧寮€鏀句簡 Gemini 2.5锛屽彲浠ラ€夋嫨锛?
```text
Model: gemini-2.5-pro
Model: gemini-2.5-flash
```

閰嶇疆鍚庣偣鍑烩€滄祴璇?API鈥濓紝鏄剧ず杩炴帴鎴愬姛鍚庡嵆鍙娇鐢ㄣ€?
## 5. 鐢ㄧ幆澧冨彉閲忛閰嶇疆

涔熷彲浠ョ敤鐜鍙橀噺鍚姩锛岄€傚悎鏈嶅姟鍣ㄦ垨鍥哄畾閮ㄧ讲銆?
### Windows PowerShell

```powershell
$env:LLM_BASE_URL="https://api.deepseek.com/v1"
$env:LLM_MODEL="deepseek-v4-flash"
$env:DEEPSEEK_API_KEY="sk-..."
npm start
```

### macOS / Linux

```bash
export LLM_BASE_URL="https://api.deepseek.com/v1"
export LLM_MODEL="deepseek-v4-flash"
export DEEPSEEK_API_KEY="sk-..."
npm start
```

涔熷彲浠ヤ娇鐢ㄩ€氱敤鍙橀噺锛?
```bash
export LLM_API_KEY="..."
```

## 6. 鎼滅储婧愰厤缃?
榛樿鎼滅储婧愭槸 DuckDuckGo HTML锛?
- 涓嶉渶瑕?API Key銆?- 涓嶉渶瑕佷粯璐广€?- 绋冲畾鎬у拰棰戠巼娌℃湁瀹樻柟淇濋殰銆?
鏇寸ǔ瀹氱殑鍟嗕笟鎼滅储婧愶細

### Serper

```bash
export SEARCH_PROVIDER="serper"
export SERPER_API_KEY="..."
```

### Tavily

```bash
export SEARCH_PROVIDER="tavily"
export TAVILY_API_KEY="..."
```

鍖诲銆佽鏂囥€丳ubMed銆丏OI 绛夐棶棰樹細棰濆璋冪敤 NCBI PubMed E-utilities锛屼笉闇€瑕?PubMed API Key銆?
## 7. 灞€鍩熺綉璁块棶

榛樿鏈嶅姟鐩戝惉鏈満绔彛 `5173`銆傚鏋滃悓涓€灞€鍩熺綉鐨勫叾浠栬澶囪璁块棶锛?
1. 纭鐩爣鐢佃剳闃茬伀澧欏厑璁?Node.js 鎴栫鍙?`5173`銆?2. 鏌ョ湅鐩爣鐢佃剳鍐呯綉 IP銆?3. 鍏朵粬璁惧璁块棶锛?
```text
http://鐩爣鐢佃剳IP:5173
```

娉ㄦ剰锛氬綋鍓嶉〉闈細鎶?API Key 淇濆瓨鍦ㄦ祻瑙堝櫒 localStorage銆傚浜哄叡鐢ㄦ椂寤鸿姣忎釜浜哄湪鑷繁鐨勬祻瑙堝櫒閲岄厤缃紝鎴栨敼涓哄彧浣跨敤鏈嶅姟绔幆澧冨彉閲忋€?
## 8. 鏇存崲绔彛

榛樿绔彛鏄?`5173`銆傚彲浠ョ敤 `PORT` 鏀癸細

### Windows PowerShell

```powershell
$env:PORT="8080"
npm start
```

### macOS / Linux

```bash
PORT=8080 npm start
```

## 9. 鍚庡彴甯搁┗杩愯

绠€鍗曟柟寮忔槸淇濇寔缁堢绐楀彛鎵撳紑銆?
濡傛灉鏄?Linux 鏈嶅姟鍣紝鍙互鐢?`systemd` 鎴?`pm2`銆傛湰椤圭洰娌℃湁寮哄埗渚濊禆杩欎簺宸ュ叿銆?
PM2 绀轰緥锛?
```bash
npm install -g pm2
pm2 start server.js --name local-research-agent
pm2 save
```

Windows 鍙互浣跨敤浠诲姟璁″垝绋嬪簭銆丯SSM锛屾垨淇濇寔 PowerShell 绐楀彛杩愯銆?
## 9A. 閲嶆柊鐢熸垚鍒嗗彂鍖?
濡傛灉浣犲湪婧愪唬鐮佷笂鍋氫簡淇敼锛屾兂閲嶆柊鐢熸垚鍙垎鍙戝寘锛?
```powershell
cd C:\Users\zhao9\Desktop\Research Agent
powershell -ExecutionPolicy Bypass -File scripts\build-distribution.ps1
```

鐢熸垚缁撴灉锛?
- 鍒嗗彂鐩綍锛歚dist\LocalResearchAgent`
- 鍘嬬缉鍖咃細`dist\LocalResearchAgent-win-x64.zip`

## 10. 杩佺Щ鍘嗗彶浼氳瘽

鍘嗗彶浼氳瘽淇濆瓨鍦ㄦ祻瑙堝櫒 localStorage锛屼笉鍦ㄩ」鐩枃浠跺す閲屻€?
鍥惧舰鍚姩鍣ㄩ噷璁剧疆鐨勭鍙ｄ繚瀛樺湪鍚姩鍣ㄧ洰褰曚笅鐨?`launcher.config` 鏂囦欢涓€?
濡傛灉鍙鍒堕」鐩枃浠讹紝鍙︿竴鍙扮數鑴戜笉浼氬甫涓婃棫娴忚鍣ㄩ噷鐨勫巻鍙蹭細璇濄€傚綋鍓嶇増鏈繕娌℃湁瀵煎嚭/瀵煎叆浼氳瘽鎸夐挳銆傚鏋滈渶瑕佽縼绉诲巻鍙诧紝鍙互鍚庣画澧炲姞瀵煎嚭 JSON 鍜屽鍏?JSON 鍔熻兘銆?
## 11. 甯歌闂

### 椤甸潰鑳芥墦寮€锛屼絾鍥炵瓟鎻愮ず鏈厤缃ā鍨?
妫€鏌ュ彸涓婅璁剧疆閲岀殑 API Key锛屾垨鑰呭惎鍔ㄦ椂鏄惁璁剧疆浜?`LLM_API_KEY` / `DEEPSEEK_API_KEY`銆?
### 娴嬭瘯 API 澶辫触

妫€鏌ワ細

- Base URL 鏄惁鏄?OpenAI-compatible 鍦板潃銆?- Model 鍚嶇О鏄惁褰撳墠璐﹀彿鍙敤銆?- API Key 鏄惁姝ｇ‘銆?- 鐩爣鐢佃剳缃戠粶鏄惁鑳借闂ā鍨嬫湇鍔°€?
### 鎼滅储缁撴灉涓嶇ǔ瀹?
DuckDuckGo HTML 涓嶄繚璇佺ǔ瀹氥€傚鏋滈暱鏈熶娇鐢紝寤鸿鍒囨崲鍒?Serper 鎴?Tavily銆?
### PubMed 鑳戒笉鑳芥煡

鍙互銆傚鏈€佸尰瀛︺€佽鏂囥€丏OI銆丳ubMed 鐩稿叧闂浼氬悓鏃朵娇鐢?PubMed E-utilities 鍜岀綉椤垫悳绱€?
### API Key 瀹夊叏

濡傛灉鍦ㄩ〉闈㈣缃?API Key锛屽畠浼氫繚瀛樺湪褰撳墠娴忚鍣?localStorage銆傚崟鏈轰娇鐢ㄩ€氬父瓒冲锛涘鏋滈儴缃茬粰澶氫汉浣跨敤锛屽缓璁敼鎴愮幆澧冨彉閲忔柟寮忥紝骞堕殣钘忓墠绔?API Key 杈撳叆銆?
