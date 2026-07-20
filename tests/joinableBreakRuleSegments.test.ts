import { describe, expect, it } from "vitest"

import { analyzeTextByType } from "../src/analysis/analyzeTextByType"
import { joinableBreakRule } from "../src/analysis/joinableBreakRule"

describe("joinableBreakRule (segments)", () => {
  it("does not flag when one side is full and the other is not", () => {
    const text = [
      "00:03:19:29\t00:03:20:26\t我的孩子說",
      "My kid said:",
      "00:03:20:26\t00:03:22:12\t妳就讓我喝一口",
      "\"Just let me have a sip.\"",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags abbreviation splits like Ph. followed by D.", () => {
    const text = [
      "00:14:40:02\t00:14:41:06\t我們有的孩子",
      "Some of our patients have even gone on to pursue a Ph.",
      "00:14:41:06\t00:14:42:08\t一路已經培養了",
      "D. But they've still faced many challenges.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "JOINABLE_BREAK",
      text: "Some of our patients have even gone on to pursue a Ph.",
      nextText: "D. But they've still faced many challenges.",
    })
  })

  it("does not treat a word ending as a split abbreviation boundary", () => {
    const text = [
      "00:41:28:00\t00:41:28:24\t沒有",
      "No. Some became presidents like Kennedy.",
      "00:41:28:24\t00:41:31:12\t有的人變成甘迺迪去當總統了",
      "No. Some became presidents like Kennedy.",
      "00:41:31:12\t00:41:32:25\t有的人變瑪麗蓮夢露",
      "Some became stars like Marilyn Monroe.",
      "00:41:32:25\t00:41:35:16\t去當有名的明星",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag adjacent identical full-sentence translations", () => {
    const text = [
      "00:03:20:13\t00:03:21:05\t沒有",
      "No. Reading is easy.",
      "00:03:21:05\t00:03:22:14\t閱讀很簡單",
      "No. Reading is easy.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag manually suppressed countdown cues", () => {
    const text = [
      "00:05:06:14\t00:05:07:16\t五",
      "Five. #",
      "00:05:07:16\t00:05:08:24\t四",
      "Four. #",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("ignores trailing CPS suppression markers for sentence checks", () => {
    const text = [
      "00:03:21:08\t00:03:23:14\t然後到了初中那一段",
      "In junior high, I attended Cheng Yuan High School,",
      "00:03:23:14\t00:03:25:05\t我念的是成淵中學",
      "In junior high, I attended Cheng Yuan High School,",
      "00:03:25:05\t00:03:26:21\t比較嚴格一點",
      "which was a bit stricter. #",
      "00:03:26:21\t00:03:28:03\t不過三年很快過去",
      "Three years later,",
      "00:03:28:03\t00:03:31:16\t我就進了建中跟隨著仁祿",
      "I followed Eric to Chien Kuo High.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags dash continuation when both sides are non-full", () => {
    const text = [
      "00:07:51:16\t00:07:53:03\t是這一點有問題",
      "It was this---",
      "00:07:54:01\t00:07:55:08\t這裡有問題",
      "right here.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)
  })

  it("flags comma continuation when both sides are non-full", () => {
    const text = [
      "00:22:34:22\t00:22:35:17\t具體來講",
      "So after hearing all this,",
      "00:22:35:17\t00:22:36:07\t聽了那麼多",
      "So after hearing all this,",
      "00:22:36:07\t00:22:37:11\t講了那麼多",
      "So after hearing all this,",
      "00:22:37:11\t00:22:38:28\t到底具體我應該要怎麼做",
      "what should you do?",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])

    expect(metrics).toHaveLength(1)
  })

  it("does not flag when joining would exceed max chars", () => {
    const text = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "This first translation chunk is intentionally quite long",
      "00:00:09:00\t00:00:10:00\tMarker",
      "and this continuation makes the merged line exceed limit.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when the timing gap is too large", () => {
    const text = [
      "00:00:08:00\t00:00:09:00\tMarker",
      "My kid said:",
      "00:00:12:00\t00:00:13:00\tMarker",
      "\"Just let me have a sip.\"",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when previous line looks like an incomplete sentence fragment", () => {
    const text = [
      "00:05:04:04\t00:05:05:06\t這樣的一些辛苦",
      "went through this.",
      "00:05:05:07\t00:05:07:11\t更何況是一般社會大眾呢",
      "So imagine everyone else.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag adjacent duplicate translations used for spanning", () => {
    const text = [
      "00:05:19:29\t00:05:20:22\t我們在面對",
      "When a new life is coming,",
      "00:05:20:22\t00:05:21:18\t新生命的到來",
      "When a new life is coming,",
      "00:05:21:18\t00:05:22:24\t我們會花很多心思",
      "we put a lot of thought into preparing for it.",
      "00:05:22:24\t00:05:24:25\t去準備待產包",
      "we put a lot of thought into preparing for it.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags fitting joins inside repeated span chunks", () => {
    const text = [
      "00:07:36:00\t00:07:37:23\t培訓跟規畫",
      "could bridge those two completely",
      "00:07:37:23\t00:07:38:27\t我發現",
      "could bridge those two completely",
      "00:07:38:27\t00:07:41:12\t我好像是臺灣少數可以",
      "could bridge those two completely",
      "00:07:41:12\t00:07:42:18\t整合兩邊",
      "different fields.",
      "00:07:42:18\t00:07:44:21\t完全不相干領域的",
      "different fields.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])

    expect(metrics).toContainEqual(
      expect.objectContaining({
        type: "JOINABLE_BREAK",
        text: "could bridge those two completely",
        nextText: "different fields.",
      })
    )
  })

  it("flags fitting boundaries between duplicated span chunks", () => {
    const text = [
      "00:20:52:17\t00:20:54:06\t都這麼努力了",
      "After all that effort,",
      "00:20:54:06\t00:20:56:12\t耗費心力地去提案了",
      "After all that effort,",
      "00:20:56:12\t00:20:57:12\t去回饋了",
      "wouldn't you be disappointed",
      "00:20:57:12\t00:20:58:21\t去跟他互動了",
      "wouldn't you be disappointed",
      "00:20:58:21\t00:21:01:03\t還沒有得到好的結果",
      "if you still didn't get the result you wanted?",
      "00:21:01:03\t00:21:03:20\t難道你不難過嗎",
      "if you still didn't get the result you wanted?",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toContainEqual(
      expect.objectContaining({
        type: "JOINABLE_BREAK",
        text: "After all that effort,",
        nextText: "wouldn't you be disappointed",
      })
    )
  })

  it("does not flag duplicated span boundaries for workplace/professional wording", () => {
    const text = [
      "00:22:03:16\t00:22:04:13\t最後",
      "What matters most in the workplace is",
      "00:22:04:13\t00:22:06:15\t專業的確是在",
      "What matters most in the workplace is",
      "00:22:06:15\t00:22:08:25\t職場上面的不二法則",
      "what you bring to the table.",
      "00:22:08:25\t00:22:10:06\t你不能沒有專業",
      "You can't get by on people skills alone.",
      "00:22:10:06\t00:22:12:20\t只靠做人就想要打通關",
      "You can't get by on people skills alone.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags duplicated span boundaries when both sides are full joinable sentences", () => {
    const text = [
      "00:01:44:00\t00:01:45:00\t東西都有帶嗎",
      "Did you bring everything?",
      "00:01:45:00\t00:01:46:00\t有",
      "Did you bring everything?",
      "00:01:46:00\t00:01:47:00\t譬如水杯",
      "Like your water bottle?",
      "00:01:47:00\t00:01:48:00\t有 喔好",
      "Like your water bottle?",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "JOINABLE_BREAK",
      text: "Did you bring everything?",
      nextText: "Like your water bottle?",
    })
  })

  it("flags a duplicated span boundary before a one-word full question", () => {
    const text = [
      "00:10:20:14\t00:10:21:15\t各位",
      "It's invalid.",
      "00:10:21:15\t00:10:22:11\t無效",
      "It's invalid.",
      "00:10:22:11\t00:10:23:05\t為什麼",
      "Why?",
      "00:10:23:05\t00:10:24:29\t沒有親自簽名",
      "Because it wasn't signed,",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])

    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "JOINABLE_BREAK",
      text: "It's invalid.",
      nextText: "Why?",
    })
  })

  it("does not flag when left side is a complete sentence before a comma-ended continuation", () => {
    const text = [
      "00:17:59:13\t00:18:00:17\t概念上大概是這樣",
      "That's the basic idea.",
      "00:18:00:17\t00:18:02:12\t如果你有相關的需求",
      "That's the basic idea.",
      "00:18:02:12\t00:18:03:16\t就可以回頭再去",
      "If you want to know more,",
      "00:18:03:16\t00:18:04:14\t認真研究起來",
      "If you want to know more,",
      "00:18:04:14\t00:18:06:15\t什麼叫做意定監護",
      "you can always look into it later.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags when both sides are short full sentences", () => {
    const text = [
      "00:41:14:23\t00:41:17:20\t他很喜歡那種滿足感",
      "That's a real shame.",
      "00:41:17:20\t00:41:20:07\t可是這限制了他的創造力",
      "It limits their creativity.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)
    expect(metrics[0]).toMatchObject({
      type: "JOINABLE_BREAK",
      text: "That's a real shame.",
      nextText: "It limits their creativity.",
    })
  })

  it("does not flag comma-continuation chain as joinable break", () => {
    const text = [
      "00:18:53:24\t00:18:55:06\tMarker",
      "If my mom told me to do something,",
      "00:18:55:06\t00:18:57:11\tMarker",
      "I'd do the opposite.",
      "00:18:57:11\t00:19:00:29\tMarker",
      "So there was a lot of tension.",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when the next line does not end with sentence punctuation", () => {
    const text = [
      "00:10:08:10\t00:10:09:20\t來到了財務",
      "Now, finances.",
      "00:10:09:20\t00:10:11:18\t會關注到財務重點",
      "I once had a client",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags when previous line ends with comma and both sides are non-full", () => {
    const text = [
      "00:21:39:12\t00:21:41:16\tMarker",
      "The next morning,",
      "00:21:41:16\t00:21:42:16\tMarker",
      "my elderly friend said",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)
  })

  it("flags when the next line ends with a comma and both sides are non-full", () => {
    const text = [
      "00:18:53:06\t00:18:54:17\t在什麼地方",
      "where they came from,",
      "00:18:54:17\t00:18:57:19\t他所期待產生的後果是什麼",
      "what outcome was intended,",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)
  })

  it("does not flag when first line is fragment but next line is full question", () => {
    const text = [
      "00:05:42:12\t00:05:44:19\t何不好好好利用這個時間",
      "we've always wanted to do?",
      "00:05:44:19\t00:05:47:13\t不是此時此刻又待何時呢",
      "If not now, then when?",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("flags when both adjacent lines are comma-ended fragments and join fits", () => {
    const text = [
      "00:20:07:06\t00:20:10:15\t回應的原則非常簡單",
      "Admit mistakes,",
      "00:20:10:15\t00:20:11:17\t有錯就認錯",
      "show proof,",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(1)
  })

  it("does not flag when left side is a complete sentence and next is a trailing fragment", () => {
    const text = [
      "00:05:17:01\t00:05:19:06\t他們兩個八十幾歲",
      "They were both in their 80s.",
      "00:05:19:06\t00:05:21:20\t今年非常不幸地",
      "Unfortunately, this year,",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag when left side ends a question and next line is an incomplete clause", () => {
    const text = [
      "00:10:31:02\t00:10:32:17\t什麼叫做真情",
      "\"Do you even know what love is?\"",
      "00:10:32:17\t00:10:34:19\t所以最後",
      "But A Guang was kind,",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })

  it("does not flag duplicated span boundary before a standalone multi-word question", () => {
    const text = [
      "00:05:35:12\t00:05:36:22\t姚爸爸",
      "Mr. Yao, they were influenced by you.",
      "00:05:36:22\t00:05:38:10\t他們兩個有受您影響",
      "Mr. Yao, they were influenced by you.",
      "00:05:38:10\t00:05:40:16\t您受誰影響呢",
      "Who influenced you?",
    ].join("\n")

    const metrics = analyzeTextByType(text, "subs", [joinableBreakRule()])
    expect(metrics).toHaveLength(0)
  })
})
