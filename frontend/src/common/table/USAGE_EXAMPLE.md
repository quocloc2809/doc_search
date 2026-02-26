# Table layout common usage

```jsx
import { calculateTableLayout } from '../table'

const layout = calculateTableLayout({
  columnCount: 8,
  tableWidth: 1200,
  longColumns: {
    1: 260, // cột số 2
    3: 320, // cột số 4
  },
  minAutoColumnWidth: 90,
})

// layout.columnWidths -> [90, 260, 90, 320, 90, 90, 90, 90]
// layout.columnStyles -> dùng trực tiếp cho <col>

<table style={{ width: `${layout.tableWidth}px` }}>
  <colgroup>
    {layout.columnStyles.map((style, index) => (
      <col key={index} style={style} />
    ))}
  </colgroup>
</table>
```

Lưu ý:
- `longColumns` hỗ trợ object (`{ index: width }`) hoặc array (`[{ index, width }]`).
- Nếu phần còn lại không đủ, hàm vẫn đảm bảo cột tự chia có `minAutoColumnWidth`.
- `overflowWidth > 0` nghĩa là tổng cột đang vượt `tableWidth`.
