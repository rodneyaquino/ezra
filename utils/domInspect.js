// Temporary DOM inspection script
module.exports = async (page) => {
  const info = await page.evaluate(() => {
    const results = { timeSlots: [], calendarDays: [], bodySnippet: "" };

    // Find time slot elements
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    const timeRe = /^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i;
    while ((node = walker.nextNode())) {
      if (timeRe.test(node.textContent || "")) {
        const el = node.parentElement;
        if (!el) continue;
        const p = el.parentElement;
        const gp = p ? p.parentElement : null;
        results.timeSlots.push({
          text: (node.textContent || "").trim(),
          tag: el.tagName,
          cls: (el.className || "").substring(0, 80),
          vis: el.offsetHeight > 0,
          pTag: p ? p.tagName : "",
          pCls: (p ? p.className || "" : "").substring(0, 80),
          pVis: p ? p.offsetHeight > 0 : false,
          gpTag: gp ? gp.tagName : "",
          gpCls: (gp ? gp.className || "" : "").substring(0, 80),
          gpVis: gp ? gp.offsetHeight > 0 : false,
        });
        if (results.timeSlots.length >= 3) break;
      }
    }

    // Find calendar day buttons
    const btns = document.querySelectorAll("button");
    for (const btn of btns) {
      const t = (btn.textContent || "").trim();
      if (/^[MTWFS]\s*\d{1,2}$/.test(t)) {
        const spans = btn.querySelectorAll("span[data-testid]");
        const dtid = spans.length > 0 ? spans[0].getAttribute("data-testid") : "none";
        const wrapper = btn.closest(".vuecal__cell") || btn.parentElement;
        results.calendarDays.push({
          text: t,
          btnCls: (btn.className || "").substring(0, 80),
          wrapperCls: (wrapper ? wrapper.className || "" : "").substring(0, 80),
          dtid: dtid,
        });
        if (results.calendarDays.length >= 3) break;
      }
    }

    return results;
  });
  return JSON.stringify(info, null, 2);
};
