// 条目池：先用任务说明 §3「必配最低集」5 项占位。
// TODO(11/5): 换成安徽省《家庭应急物资储备建议清单》基础版 4 大类 14 项，
// 每条必须带「10 秒判据」或「转渠道」，否则不入清单（任务说明 §4）。
export type Answer = 'yes' | 'no' | 'unsure'

export type Item = {
  id: string
  name: string
  /** 10 秒可执行的判据；给不出判据的条目不入清单 */
  check: string
}

export const ITEMS: Item[] = [
  { id: 'torch', name: '手电（可手摇充电）', check: '按一下开关能亮；摇 30 秒还能亮' },
  { id: 'whistle', name: '救生哨', check: '吹一下有响声，挂在门口或床头' },
  { id: 'water', name: '饮用水与压缩饼干', check: '够全家喝 3 天，看包装日期' },
  { id: 'towel', name: '毛巾 / 纸巾', check: '在洗手间和玄关各有一份' },
  { id: 'firstaid', name: '创可贴 + 纱布 + 碘伏棉棒', check: '打开药箱，三样都在且没过期' },
]
