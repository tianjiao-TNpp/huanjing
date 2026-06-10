/* 激活码配置 — 只有持有有效激活码的人才能使用本应用。
 *
 * 工作方式：用户输入激活码 → 用 SHA-256(salt + ":" + 码) 计算哈希 →
 *           与下表 codes 中的 hash 比对，命中即放行，并记住在该设备。
 * 明文码不存在本文件里，所以即使别人看到本文件也无法直接读出码。
 *
 * ── 如何新增一个人 ──
 *   运行:  python scripts/gen_code.py 张三
 *   把它输出的 {label, hash} 这一行加到下面 codes 数组里，重新部署即可。
 *   把它同时输出的「明文激活码」私下发给那个人。
 *
 * ── 如何吊销某人 ──
 *   删除下面 codes 里对应那一行（按 label 找），重新部署。
 *   该人下次打开（或清缓存后）就进不来了。
 *
 * ── 临时关闭整个验证 ──  把 enabled 改成 false。
 *
 * 注意：这是纯前端门禁，能挡住普通人，但拦不住懂技术、会直接下载数据文件的人。
 *       对“备考词库”这类场景足够；若要严格收费/防破解需配后端，另说。
 */
window.HJ_ACCESS = {
  enabled: true,
  salt: "17a86803048fbfdb",
  codes: [
    { label: "自己(master)", hash: "9acc792a383978644696c37d8abbdd793239822e51ce086e334fb6cf1fac632d" },
    { label: "备用01", hash: "383a10d6e9f8f8a83e999bbc0acbbaaa99d6e71320d24556d05d2f49a7cfba03" },
    { label: "备用02", hash: "13e7f474dee97bcbac72962f329cad1e889025476f020a2e54faf8f205caed35" },
    { label: "备用03", hash: "4decff4238f26cb23772fc08a104a9faefefabf0f8324d2ccadc2bd5dd3871c8" },
    { label: "备用04", hash: "5ea2b3e72951ba59914ec1da0308602d8e45140ebc0d31437154903f5f69ab51" },
    { label: "备用05", hash: "5233a073c0b84e4de331b3886ea12c957b874ce328785a646510f10608a5133b" },
    { label: "备用06", hash: "3082963316b9d66545926df9ad52fc2faca7ea392c77d80e5c49a17e4096785e" },
    { label: "备用07", hash: "f00c18515b7b42d307a051946cc905e54a4ec24a190849ef0df890163c661636" },
    { label: "备用08", hash: "4640be7361a04919e87417c09f9bdd622374a6f7f8c02a0b9377b35de7b812c6" },
    { label: "备用09", hash: "3db83dbb62a811f5989bb7bac9828e19107ff85806f5e3476a9335b7e31ad92c" },
    { label: "备用10", hash: "c606b06447cedd6e2654454c25c4c3cfe3d2a712927185f4331d7ba2ad99aa78" },
    { label: "备用11", hash: "4450ef667abb48349c5d3d0ba0f09dff020695016651801ab6a79780860f1eb7" }
  ]
};
