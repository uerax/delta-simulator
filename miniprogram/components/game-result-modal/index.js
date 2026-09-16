// components/game-result-modal/index.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '挑战完成！'
    },
    isNewRecord: {
      type: Boolean,
      value: false
    },
    badgeText: {
      type: String,
      value: '🏆 刷新历史最高纪录！'
    },
    items: {
      type: Array,
      value: [] // Array<{ label: string, value: string, highlight?: boolean, highlightColor?: string }>
    },
    primaryBtnText: {
      type: String,
      value: '再玩一局'
    },
    secondaryBtnText: {
      type: String,
      value: '返回大厅'
    }
  },

  methods: {
    onTapPrimary() {
      this.triggerEvent('restart');
    },
    onTapSecondary() {
      this.triggerEvent('home');
    }
  }
});
