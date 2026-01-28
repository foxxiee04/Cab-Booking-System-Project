# Customer App - Giao diện đặt xe hiện đại

## Tính năng mới

### 🗺️ Tích hợp TrackAsia Maps
- Hiển thị bản đồ toàn màn hình với giao diện chuyên nghiệp
- Marker động với animation
- Vẽ tuyến đường giữa điểm đón và điểm đến
- Navigation controls và geolocation

### 🔍 Tìm kiếm địa điểm thông minh
- **Autocomplete**: Gợi ý địa điểm khi nhập
- **TrackAsia Geocoding API**: Tìm kiếm địa điểm tại Việt Nam
- **Địa điểm phổ biến**: Gợi ý các địa điểm nổi tiếng
- **Debounce search**: Tối ưu hiệu suất

### 🚗 Chọn loại xe
- **4 loại xe**: Economy, Comfort, Premium, SUV
- **Hiển thị giá**: Ước tính giá theo từng loại xe
- **Thông tin chi tiết**: Capacity, features, giá nhân
- **UI đẹp mắt**: Card design với animations

### 📱 Giao diện responsive
- **Mobile-first**: Sliding panel từ dưới lên
- **Desktop**: Fixed panel bên trái
- **Smooth animations**: Transitions mượt mà
- **Touch-friendly**: Buttons có kích thước phù hợp

## Cấu trúc files

```
src/
├── app/
│   ├── book/
│   │   └── page.tsx          # Trang đặt xe chính (ĐÃ LÀM MỚI)
│   ├── page.tsx               # Homepage (ĐÃ CẢI THIỆN)
│   └── globals.css            # Styles toàn cục (ĐÃ BỔ SUNG)
├── components/
│   ├── LocationSearchInput.tsx  # Autocomplete tìm kiếm (MỚI)
│   ├── VehicleSelector.tsx      # Chọn loại xe (MỚI)
│   ├── MapGoogle.tsx            # Map component (ĐÃ NÂNG CẤP)
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       └── input.tsx
└── lib/
    ├── geocoding.ts          # Service tìm kiếm địa điểm (MỚI)
    └── api.ts                # API client
```

## Components mới

### LocationSearchInput
Component tìm kiếm địa điểm với autocomplete:
- Props: `type`, `value`, `onChange`, `onLocationSelect`
- Tích hợp TrackAsia Geocoding API
- Hiển thị dropdown suggestions
- Debounce search (300ms)

### VehicleSelector  
Component chọn loại xe:
- Props: `selected`, `onChange`, `estimatedPrice`, `distance`, `duration`
- 4 loại xe với giá khác nhau
- Hiển thị features và capacity
- Responsive grid layout

### MapGoogle (nâng cấp)
- Thêm navigation controls
- Thêm geolocation
- Custom markers với emoji
- Curved polyline
- Loading state

## API Geocoding

### Search locations
```typescript
import { searchLocations } from '@/lib/geocoding';

const results = await searchLocations('Bến Thành', 5);
// Returns: LocationSuggestion[]
```

### Reverse geocoding
```typescript
import { reverseGeocode } from '@/lib/geocoding';

const result = await reverseGeocode(10.7726, 106.6980);
// Returns: GeocodingResult
```

## Styling

### Custom CSS classes
- `.custom-marker`: Marker animation
- `.slide-up`: Panel slide animation  
- `.bg-gradient-primary`: Gradient backgrounds
- `.trackasia-*`: Map controls styling

### Tailwind utilities
- Responsive breakpoints: `md:`, `lg:`
- Hover effects: `hover:scale-105`
- Transitions: `transition-all duration-300`

## Environment Variables

```env
NEXT_PUBLIC_TRACKASIA_KEY=6ce5471f943d628580a17695354821b1d4
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Flow đặt xe

1. **Nhập điểm đón**: Autocomplete search
2. **Nhập điểm đến**: Autocomplete search  
3. **Xem bản đồ**: Markers và route hiển thị
4. **Tìm xe**: Gọi API estimate
5. **Chọn loại xe**: 4 options với giá khác nhau
6. **Đặt xe**: Gọi API create ride
7. **Chuyển trang**: Redirect to /rides

## Cải tiến so với version cũ

### ❌ Cũ
- Input text đơn giản
- Không có autocomplete
- Địa điểm mẫu hardcode
- Không có map toàn màn hình
- UI đơn giản, ít tương tác

### ✅ Mới
- Autocomplete thông minh
- Tích hợp Geocoding API
- Map toàn màn hình
- Sliding panel responsive
- 4 loại xe với giá rõ ràng
- Animations mượt mà
- Professional UI/UX

## Chạy app

```bash
cd frontend/customer-app
npm install
npm run dev
```

App chạy tại: http://localhost:4000

## Screenshots

### Desktop View
- Map toàn màn hình
- Panel cố định bên trái
- 2 bước: Location → Vehicle

### Mobile View  
- Map toàn màn hình
- Sliding panel từ dưới
- Swipe để mở/đóng panel

## Tối ưu hóa

- ✅ Debounce search (300ms)
- ✅ Lazy load map controls
- ✅ Optimize re-renders
- ✅ Remove unused components
- ✅ Clean CSS utilities
- ✅ TypeScript strict mode

## Known Issues

- Geocoding API có rate limit
- Map cần internet để load tiles
- Mobile keyboard có thể che panel

## Next Steps

- [ ] Thêm recent searches
- [ ] Save favorite locations  
- [ ] Real-time driver tracking
- [ ] Payment method selection
- [ ] Promo codes
