/*
 * LogicLab 題庫設定檔（老師可以自行修改）
 * ------------------------------------------------------------
 * 每一題的欄位：
 *   id        題目代號（英數字，不可重複；批改時用來辨認題目）
 *   group     題組名稱（題目選單中的分組）
 *   level     難度 1 入門、2 基礎、3 進階、4 挑戰
 *   title     題目名稱
 *   desc      題目說明（可以用簡單的 HTML，例如 <b>、<code>、<br>）
 *   inputs    輸入變數名稱，依序排列（第一個是真值表的最高位元）
 *   outputs   每個輸出的目標，可以寫：
 *               布林式   "A'B + C"、"(A + B)(C + D)"、"A ⊕ B"（也可寫 A ^ B）
 *               最小項   "m(1, 3, 5)"、"m(1, 2) + d(3)"（d 為無關項）
 *   allowed   （選填）只能使用的閘，例如 ['NAND']；不填代表都可以用
 *   maxGates  （選填）最多可以用幾個閘
 *   maxFanIn  （選填）每個閘最多幾個輸入
 *   showTarget（選填）true：題目頁直接顯示目標真值表
 *   selfCheck （選填）false：學生不能自己按「檢查答案」（例如考試）
 *   hint      （選填）提示
 * 可用的閘：AND、OR、NOT、NAND、NOR、XOR、XNOR、BUF
 */
window.LOGIC_LAB_CONFIG = {
  courseName: '數位邏輯設計｜邏輯閘與布林代數練習',

  exercises: [
    // ───────── 認識邏輯閘 ─────────
    {
      id: 'w4-01', group: '第 4 週｜認識邏輯閘', level: 1,
      title: '第一個電路：AND 閘',
      desc: '<p>把一個 <b>AND 閘</b>拖到畫布上，將輸入 <b>A、B</b> 接到它的兩個輸入端，再把它的輸出接到 <b>F</b>。</p><p>完成後點一下輸入開關，觀察 F 在什麼情況下會變成 1。</p>',
      inputs: ['A', 'B'],
      outputs: { F: 'AB' },
      maxGates: 1,
      hint: '從 A 右側的小圓點「拖曳」到 AND 閘左側的輸入端，放開滑鼠就完成連線。'
    },
    {
      id: 'w4-02', group: '第 4 週｜認識邏輯閘', level: 1,
      title: '多輸入閘：三輸入 AND 與 OR',
      desc: '<p>用<b>兩個</b>閘同時完成：<br><code>F = ABC</code>、<code>G = A + B + C</code></p><p>選取閘後，上方工具列可以把<b>輸入數</b>改成 3。一個輸入可以同時接到很多個閘（扇出）。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: 'ABC', G: 'A + B + C' },
      maxGates: 2,
      hint: '點選 AND 閘 → 上方工具列的「輸入數」按 + 變成 3。'
    },
    {
      id: 'w4-03', group: '第 4 週｜認識邏輯閘', level: 2,
      title: '只用 NAND 做出 NOT',
      desc: '<p>只能使用 <b>NAND 閘</b>，做出 <code>F = A\'</code>。</p><p>想一想：NAND 的兩個輸入如果接在一起，會發生什麼事？</p>',
      inputs: ['A'],
      outputs: { F: "A'" },
      allowed: ['NAND'], maxGates: 1,
      hint: '(A·A)\' = A\'，把 A 同時接到 NAND 的兩個輸入端。'
    },
    {
      id: 'w4-04', group: '第 4 週｜認識邏輯閘', level: 2,
      title: '只用 NAND 做出 AND',
      desc: '<p>只能使用 <b>NAND 閘</b>，做出 <code>F = AB</code>。</p>',
      inputs: ['A', 'B'],
      outputs: { F: 'AB' },
      allowed: ['NAND'], maxGates: 2,
      hint: 'AB = ((AB)\')\'：先用一個 NAND，再把結果反相（反相也用 NAND 做）。'
    },
    {
      id: 'w4-05', group: '第 4 週｜認識邏輯閘', level: 3,
      title: '只用 NAND 做出 OR',
      desc: '<p>只能使用 <b>NAND 閘</b>，做出 <code>F = A + B</code>。</p><p>這一題說明了 NAND 是<b>萬用閘</b>：NOT、AND、OR 都能只用 NAND 做出來。</p>',
      inputs: ['A', 'B'],
      outputs: { F: 'A + B' },
      allowed: ['NAND'], maxGates: 3,
      hint: 'A + B = (A\'B\')\'：先分別做出 A\'、B\'，再送進一個 NAND。'
    },
    {
      id: 'w4-06', group: '第 4 週｜認識邏輯閘', level: 3,
      title: '只用 NOR 做出 AND',
      desc: '<p>只能使用 <b>NOR 閘</b>，做出 <code>F = AB</code>。NOR 也是萬用閘。</p>',
      inputs: ['A', 'B'],
      outputs: { F: 'AB' },
      allowed: ['NOR'], maxGates: 3,
      hint: 'AB = (A\' + B\')\'：先用 NOR 做出 A\'、B\'，再送進一個 NOR。'
    },

    // ───────── 由布林式畫電路 ─────────
    {
      id: 'w4-07', group: '第 4 週｜由布林式畫電路', level: 2,
      title: 'F = A\'B + C',
      desc: '<p>依照布林表示式 <code>F = A\'B + C</code> 畫出電路（只能用 AND、OR、NOT）。</p><p>完成後到「真值表」分頁，確認電路寫出的布林式和題目一樣。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: "A'B + C" },
      allowed: ['AND', 'OR', 'NOT'], maxGates: 3,
      hint: 'NOT 產生 A\' → 和 B 做 AND → 再和 C 做 OR。'
    },
    {
      id: 'w4-08', group: '第 4 週｜由布林式畫電路', level: 2,
      title: '二層 AND-OR 電路：F = AB + CD',
      desc: '<p>用 AND、OR 畫出 <code>F = AB + CD</code>。</p><p>這種「先 AND 再 OR」的電路稱為<b>二層（two-level）AND-OR 電路</b>，對應積項和（SOP）。</p>',
      inputs: ['A', 'B', 'C', 'D'],
      outputs: { F: 'AB + CD' },
      allowed: ['AND', 'OR'], maxGates: 3
    },
    {
      id: 'w4-09', group: '第 4 週｜由布林式畫電路', level: 3,
      title: '只用 AND、OR、NOT 做出 XOR',
      desc: '<p>XOR 可以寫成 <code>A ⊕ B = A\'B + AB\'</code>。請只用 <b>AND、OR、NOT</b> 做出 <code>F = A ⊕ B</code>。</p>',
      inputs: ['A', 'B'],
      outputs: { F: 'A ⊕ B' },
      allowed: ['AND', 'OR', 'NOT'], maxGates: 5,
      hint: '需要 2 個 NOT、2 個 AND、1 個 OR。'
    },
    {
      id: 'w4-10', group: '第 4 週｜由布林式畫電路', level: 2,
      title: '三輸入 XOR（奇同位產生器）',
      desc: '<p>只能用 <b>2 輸入的 XOR 閘</b>，做出 <code>F = A ⊕ B ⊕ C</code>。</p><p>觀察真值表：輸入中 1 的個數為<b>奇數</b>時 F = 1。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: 'A ⊕ B ⊕ C' },
      allowed: ['XOR'], maxGates: 2, maxFanIn: 2
    },
    {
      id: 'w4-11', group: '第 4 週｜由布林式畫電路', level: 3,
      title: '三輸入 XNOR 的陷阱',
      desc: '<p>三輸入 XNOR：<code>F = (A ⊕ B ⊕ C)\'</code>，也就是 1 的個數為<b>偶數</b>時 F = 1。</p><p>只能用 <b>2 輸入</b>的 XOR、XNOR，最多 2 個閘。<br>先試試把兩個 XNOR 直接串接，再看看真值表——結果對嗎？為什麼？</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: "(A ⊕ B ⊕ C)'" },
      allowed: ['XOR', 'XNOR'], maxGates: 2, maxFanIn: 2,
      hint: '兩個 XNOR 串接：((A ⊕ B)\' ⊕ C)\' = A ⊕ B ⊕ C，兩次反相互相抵消，結果變成 XOR。改用一個 XOR 加一個 XNOR。'
    },

    // ───────── 組合電路設計 ─────────
    {
      id: 'w4-12', group: '第 4 週｜組合電路設計', level: 2,
      title: '樓梯燈（兩地控制）',
      desc: '<p>樓梯的電燈 <b>L</b> 由樓上開關 <b>A</b> 與樓下開關 <b>B</b> 控制：兩個開關都在 0 時燈是暗的，之後<b>任何一個開關切換</b>，燈的狀態就會改變。</p><p>先寫出真值表，再設計電路。</p>',
      inputs: ['A', 'B'],
      outputs: { L: 'A ⊕ B' },
      hint: '列出 4 種情況：00→0，01→1，10→1，11→0。這是哪一種閘？'
    },
    {
      id: 'w4-13', group: '第 4 週｜組合電路設計', level: 2,
      title: '半加器（Half Adder）',
      desc: '<p>設計一個把兩個 1 位元數 A、B 相加的電路，輸出<b>和 S</b> 與<b>進位 C</b>。</p><p>例如 1 + 1 = 10₂，所以 S = 0、C = 1。</p>',
      inputs: ['A', 'B'],
      outputs: { S: 'A ⊕ B', C: 'AB' },
      maxGates: 2,
      hint: 'S = A ⊕ B，C = AB。'
    },
    {
      id: 'w4-14', group: '第 4 週｜組合電路設計', level: 3,
      title: '三人多數決',
      desc: '<p>三位評審 A、B、C 投票（1 = 同意），<b>兩人以上同意</b>時通過（F = 1）。</p><p>請設計這個多數決電路。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: 'AB + BC + AC' },
      hint: '任兩人同意即可：F = AB + BC + AC。'
    },
    {
      id: 'w4-15', group: '第 4 週｜組合電路設計', level: 3,
      title: '由真值表設計電路',
      desc: '<p>依照下方的<b>目標真值表</b>設計電路：<code>F = Σm(1, 3, 5, 6, 7)</code>。</p><p>可以先直接用最小項寫出 SOP，再試著化簡、減少閘的數量。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: 'm(1, 3, 5, 6, 7)' },
      showTarget: true,
      hint: '化簡後 F = C + AB，只要 2 個閘。'
    },

    // ───────── 挑戰題 ─────────
    {
      id: 'w4-16', group: '第 4 週｜挑戰題', level: 4,
      title: '全加器（Full Adder）',
      desc: '<p>三個 1 位元輸入 A、B、Cin（前一位的進位）相加，輸出和 <b>S</b> 與進位 <b>Cout</b>。</p><p><code>S = A ⊕ B ⊕ Cin</code>，<code>Cout = AB + Cin(A ⊕ B)</code></p>',
      inputs: ['A', 'B', 'Cin'],
      outputs: { S: 'A ⊕ B ⊕ Cin', Cout: 'AB + Cin(A ⊕ B)' },
      hint: '可以用兩個半加器加一個 OR 閘組成。'
    },
    {
      id: 'w4-17', group: '第 4 週｜挑戰題', level: 4,
      title: '2 對 1 多工器（MUX）',
      desc: '<p>選擇線 <b>S</b> = 0 時輸出 <b>Y = D0</b>；S = 1 時輸出 <b>Y = D1</b>。</p><p><code>Y = S\'D0 + SD1</code></p>',
      inputs: ['S', 'D0', 'D1'],
      outputs: { Y: "S'D0 + SD1" }
    },
    {
      id: 'w4-18', group: '第 4 週｜挑戰題', level: 4,
      title: '1 位元比較器',
      desc: '<p>比較兩個 1 位元數 A、B，輸出三個訊號：<b>G</b>（A &gt; B）、<b>E</b>（A = B）、<b>L</b>（A &lt; B）。</p>',
      inputs: ['A', 'B'],
      outputs: { G: "AB'", E: "(A ⊕ B)'", L: "A'B" },
      hint: 'G = AB\'，E = (A ⊕ B)\'，L = A\'B。'
    },

    // ───────── 第 5 週：布林代數化簡（閘數上限逼你先化簡） ─────────
    {
      id: 'w5-01', group: '第 5 週｜化簡定理', level: 2,
      title: '化簡：F = A(A\' + B)',
      desc: '<p>先用布林代數化簡 <code>F = A(A\' + B)</code>，再用<b>最少的閘</b>實現。</p><p>照原式直接畫要 NOT、OR、AND 3 個閘；化簡後只能用 <b>1 個閘</b>。</p>',
      inputs: ['A', 'B'],
      outputs: { F: "A(A' + B)" },
      maxGates: 1,
      hint: '分配律：AA\' + AB，再用互補律 AA\' = 0。'
    },
    {
      id: 'w5-02', group: '第 5 週｜化簡定理', level: 2,
      title: '吸收律：F = A\'BC + A\'',
      desc: '<p>化簡 <code>F = A\'BC + A\'</code>，最多用 <b>1 個閘</b>。</p><p>化簡後有些輸入可能用不到——這很正常。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: "A'BC + A'" },
      maxGates: 1,
      hint: '吸收律 X + XY = X，這裡 X = A\'、Y = BC。'
    },
    {
      id: 'w5-03', group: '第 5 週｜化簡定理', level: 2,
      title: '消去律：F = AB\' + B',
      desc: '<p>化簡 <code>F = AB\' + B</code>，最多用 <b>1 個閘</b>。</p>',
      inputs: ['A', 'B'],
      outputs: { F: "AB' + B" },
      maxGates: 1,
      hint: '消去律 XY\' + Y = X + Y。'
    },
    {
      id: 'w5-04', group: '第 5 週｜化簡定理', level: 2,
      title: '第二分配律：F = (A + B)(A + C)',
      desc: '<p>化簡 <code>F = (A + B)(A + C)</code>，最多用 <b>2 個閘</b>。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: '(A + B)(A + C)' },
      maxGates: 2,
      hint: '第二分配律 X + YZ = (X + Y)(X + Z)，反過來用：(A + B)(A + C) = A + BC。'
    },
    {
      id: 'w5-05', group: '第 5 週｜化簡定理', level: 3,
      title: '多數決電路化簡',
      desc: '<p>三人多數決逐列寫出來是 <code>F = A\'BC + AB\'C + ABC\' + ABC</code>，直接畫要 4 個 AND、1 個 OR，還要 3 個 NOT。</p><p>請先化簡，再用<b>最多 4 個閘</b>實現。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: "A'BC + AB'C + ABC' + ABC" },
      maxGates: 4,
      hint: '等冪律：ABC = ABC + ABC + ABC；再把 ABC 分別和另外三項配對，用相鄰定理 XY + XY\' = X。'
    },
    {
      id: 'w5-06', group: '第 5 週｜化簡定理', level: 3,
      title: '一致項：F = AB + A\'C + BC',
      desc: '<p>化簡 <code>F = AB + A\'C + BC</code>，最多用 <b>4 個閘</b>（NOT 也算一個閘）。</p>',
      inputs: ['A', 'B', 'C'],
      outputs: { F: "AB + A'C + BC" },
      maxGates: 4,
      hint: 'AB 與 A\'C 中只有 A 一正一反，一致項是 BC，所以 BC 是多餘的：F = AB + A\'C。'
    },
    {
      id: 'w5-07', group: '第 5 週｜SOP、POS 與笛摩根定理', level: 3,
      title: 'POS 化簡：F = (A + B\')(A + C)(A + D)',
      desc: '<p>照和之積 (POS) 直接畫要 NOT、3 個 OR、1 個 AND 共 5 個閘。</p><p>請化簡後用<b>最多 3 個閘</b>實現。</p>',
      inputs: ['A', 'B', 'C', 'D'],
      outputs: { F: "(A + B')(A + C)(A + D)" },
      maxGates: 3,
      hint: '反覆使用第二分配律：(A + B\')(A + C)(A + D) = A + B\'CD。'
    },
    {
      id: 'w5-08', group: '第 5 週｜SOP、POS 與笛摩根定理', level: 2,
      title: '只用 AND 與 NOT 做出 NOR',
      desc: '<p>只能用 <b>AND、NOT</b>，做出 <code>F = (A + B)\'</code>。</p>',
      inputs: ['A', 'B'],
      outputs: { F: "(A + B)'" },
      allowed: ['AND', 'NOT'], maxGates: 3,
      hint: '笛摩根定理：(A + B)\' = A\'B\'。'
    },
    {
      id: 'w5-09', group: '第 5 週｜SOP、POS 與笛摩根定理', level: 3,
      title: 'XOR 的補數',
      desc: '<p>用笛摩根定理求 <code>F = (A\'B + AB\')\'</code> 的最簡 SOP，只用 <b>AND、OR、NOT</b> 實現（最多 5 個閘）。</p><p>做完到「真值表」看看：F 等於哪一種閘？</p>',
      inputs: ['A', 'B'],
      outputs: { F: "(A'B + AB')'" },
      allowed: ['AND', 'OR', 'NOT'], maxGates: 5,
      hint: '(A\'B)\'(AB\')\' = (A + B\')(A\' + B) = AB + A\'B\'，也就是 XNOR。'
    }
  ]
};
