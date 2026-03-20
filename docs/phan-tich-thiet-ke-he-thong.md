# Phân Tích Thiết Kế Hệ Thống Cab Booking System

## 1. Mục tiêu tài liệu

Tài liệu này mô tả phần phân tích và thiết kế hệ thống cho dự án Cab Booking System theo góc nhìn kiến trúc microservices kết hợp tư duy Domain Driven Design. Nội dung được viết lại theo hướng dễ đưa vào báo cáo đồ án, đồng thời vẫn bám sát đúng cấu trúc triển khai thực tế trong repo hiện tại.

Mục tiêu chính của tài liệu gồm:

- Xác định bài toán nghiệp vụ mà hệ thống đang giải quyết.
- Làm rõ các actor và nhu cầu của từng nhóm người dùng.
- Phân tích các domain và bounded context chính của hệ thống.
- Giải thích vai trò của từng microservice trong kiến trúc hiện tại.
- Mô tả các luồng nghiệp vụ từ đầu đến cuối.
- Trình bày các quyết định thiết kế về dữ liệu, tích hợp, realtime, test và triển khai.

## 2. Bài toán cần giải quyết

Cab Booking System là hệ thống đặt xe công nghệ phục vụ ba nhóm người dùng chính:

- Khách hàng: đặt xe, theo dõi chuyến đi, thanh toán và đánh giá tài xế.
- Tài xế: nhận chuyến, cập nhật trạng thái chuyến, xem thu nhập và lịch sử hoạt động.
- Quản trị viên: giám sát vận hành, rides, payments, users, drivers và các chỉ số tổng quan.

Trong thực tế, một hệ thống đặt xe không chỉ dừng ở việc tạo một đơn đặt xe đơn giản. Hệ thống còn phải giải quyết đồng thời nhiều bài toán:

- Tính giá cước và thời gian ước lượng trước khi khách xác nhận.
- Gán đúng tài xế khả dụng cho chuyến đi.
- Đồng bộ trạng thái ride giữa customer app, driver app và admin dashboard gần như realtime.
- Lưu trữ lịch sử giao dịch, thanh toán và đánh giá sau chuyến.
- Cho phép từng phần hệ thống được phát triển và triển khai tương đối độc lập.

Vì vậy, việc dùng kiến trúc microservices là phù hợp với tính chất bài toán có nhiều miền nghiệp vụ riêng, nhiều actor và nhiều luồng bất đồng bộ.

## 3. Mục tiêu thiết kế hệ thống

Hệ thống được thiết kế với các mục tiêu chính sau:

- Phân tách rõ trách nhiệm giữa các miền nghiệp vụ.
- Tăng khả năng mở rộng và bảo trì khi số lượng service tăng lên.
- Giảm coupling trực tiếp giữa frontend và backend nghiệp vụ.
- Hỗ trợ realtime cho ride lifecycle.
- Cho phép test từng phần, test tích hợp và test toàn luồng.
- Hỗ trợ triển khai bằng Docker Compose và Docker Swarm.

Từ góc nhìn kỹ thuật, repo hiện tại đã hiện thực các mục tiêu này bằng:

- 3 frontend React riêng biệt.
- Một API Gateway làm điểm vào thống nhất.
- Nhiều backend service tách theo domain.
- PostgreSQL, MongoDB, Redis và RabbitMQ cho các nhu cầu dữ liệu khác nhau.
- Một AI Service riêng biệt để hỗ trợ pricing và ước lượng.

## 4. Tác nhân của hệ thống

### 4.1. Tác nhân con người

| Tác nhân | Vai trò nghiệp vụ |
| --- | --- |
| Khách hàng | Tạo yêu cầu đặt xe, theo dõi chuyến đi, thanh toán, đánh giá |
| Tài xế | Nhận chuyến, di chuyển đến điểm đón, bắt đầu và hoàn tất chuyến |
| Quản trị viên | Theo dõi dữ liệu vận hành, rides, payments, users, drivers |

### 4.2. Tác nhân hệ thống và tích hợp

| Thành phần | Vai trò |
| --- | --- |
| API Gateway | Cổng vào thống nhất, routing, xác thực và realtime hub |
| RabbitMQ | Truyền sự kiện bất đồng bộ giữa các service |
| Redis | Cache, hỗ trợ lookup nhanh và dữ liệu thời gian thực |
| PostgreSQL | Lưu dữ liệu giao dịch và dữ liệu quan hệ |
| MongoDB | Lưu dữ liệu dạng document như review, notification |
| AI Service | Hỗ trợ suy luận ETA hoặc tính toán phụ trợ cho pricing |

## 5. Kiến trúc tổng thể

Về tổng thể, hệ thống được chia thành 4 lớp chính:

### 5.1. Lớp giao diện

- Customer App
- Driver App
- Admin Dashboard

Mỗi ứng dụng phục vụ một vai trò riêng. Cách tách này giúp UI của từng vai trò độc lập, dễ phát triển và tối ưu trải nghiệm theo đúng nhu cầu thực tế.

### 5.2. Lớp điều phối truy cập

- API Gateway

API Gateway là đầu mối nhận request từ frontend, xác thực người dùng, định tuyến tới service phù hợp và hỗ trợ các luồng realtime. Việc đặt một gateway ở giữa giúp frontend không phải quản lý trực tiếp quá nhiều endpoint nội bộ.

### 5.3. Lớp nghiệp vụ microservices

Các service chính trong repo gồm:

- Auth Service
- User Service
- Booking Service
- Ride Service
- Driver Service
- Pricing Service
- Payment Service
- Review Service
- Notification Service
- AI Service

### 5.4. Lớp dữ liệu và hạ tầng

- PostgreSQL
- MongoDB
- Redis
- RabbitMQ
- Stack monitoring

## 6. Phân tích domain và bounded context

Theo hướng Domain Driven Design, hệ thống có thể chia thành các miền nghiệp vụ sau.

### 6.1. Core domain

#### Ride Orchestration

Đây là miền quan trọng nhất của hệ thống. Ride Orchestration quản lý vòng đời của chuyến đi từ lúc tạo ride, tìm tài xế, nhận chuyến, bắt đầu chuyến, hoàn tất hoặc hủy chuyến.

Miền này là trung tâm vì gần như mọi actor đều liên quan đến ride.

#### Driver Dispatch

Miền này xử lý thông tin tài xế đang hoạt động, khả năng nhận chuyến, trạng thái online và logic hỗ trợ tìm tài xế phù hợp.

#### Pricing

Miền pricing chịu trách nhiệm tính giá dự kiến, thời gian ước lượng, chi phí chuyến đi và dữ liệu liên quan trước khi khách hàng xác nhận đặt xe.

### 6.2. Supporting domain

#### Booking

Booking tiếp nhận dữ liệu điểm đón, điểm đến và yêu cầu đặt xe từ khách hàng trước khi chuyển sang ride lifecycle.

#### Payment

Payment quản lý dữ liệu thanh toán, trạng thái giao dịch và liên kết payment với ride tương ứng.

#### Review

Review phụ trách đánh giá sau chuyến đi, phục vụ thống kê chất lượng tài xế và trải nghiệm khách hàng.

#### Notification

Notification phục vụ gửi thông báo cho các actor khi trạng thái quan trọng thay đổi.

#### User Profile

User Service quản lý hồ sơ người dùng, thông tin cá nhân và dữ liệu liên quan ngoài lớp xác thực.

### 6.3. Generic domain

#### Identity and Access

Được hiện thực chủ yếu qua Auth Service. Miền này xử lý đăng nhập, token, quyền truy cập và phân vai trò.

#### API Composition

Được hiện thực qua API Gateway. Miền này không sở hữu nghiệp vụ cốt lõi nhưng rất quan trọng trong việc tổng hợp dữ liệu và cung cấp một đầu vào thống nhất cho client.

#### AI Support

AI Service đóng vai trò hỗ trợ suy luận, không trực tiếp sở hữu ride lifecycle.

## 7. Vai trò của từng microservice

### 7.1. API Gateway

Chức năng chính:

- Routing request từ frontend đến đúng service.
- Xác thực token và kiểm tra quyền truy cập.
- Tổng hợp một số dữ liệu phục vụ admin hoặc client.
- Hỗ trợ realtime qua Socket.IO.

Lý do tồn tại:

- Giảm coupling giữa client và backend nội bộ.
- Tạo một điểm kiểm soát thống nhất cho auth và realtime.

### 7.2. Auth Service

Chức năng chính:

- Đăng ký, đăng nhập.
- Quản lý token và định danh.
- Phân quyền theo role.

### 7.3. User Service

Chức năng chính:

- Quản lý hồ sơ user.
- Lưu các thông tin mô tả người dùng phục vụ hiển thị và nghiệp vụ.

### 7.4. Booking Service

Chức năng chính:

- Ghi nhận yêu cầu đặt xe ban đầu.
- Liên kết dữ liệu đầu vào đặt xe với ride lifecycle.

### 7.5. Ride Service

Chức năng chính:

- Tạo ride.
- Quản lý trạng thái ride.
- Nhận tín hiệu chấp nhận chuyến từ tài xế.
- Xử lý hoàn tất hoặc hủy chuyến.

Đây là service trung tâm của nghiệp vụ.

### 7.6. Driver Service

Chức năng chính:

- Quản lý trạng thái online hoặc offline.
- Lưu vị trí hiện tại của tài xế.
- Phục vụ matching và hiển thị dữ liệu tài xế.
- Cung cấp history và earnings cho tài xế.

### 7.7. Pricing Service

Chức năng chính:

- Ước tính giá cước.
- Tính toán dữ liệu phục vụ hiển thị trước khi đặt xe.
- Có thể gọi AI Service để hỗ trợ suy luận.

### 7.8. Payment Service

Chức năng chính:

- Sinh payment khi chuyến đi hoàn tất.
- Cập nhật trạng thái thanh toán.
- Cung cấp dữ liệu payments cho admin.

### 7.9. Review Service

Chức năng chính:

- Nhận đánh giá của customer sau chuyến.
- Lưu nhận xét, rating và dữ liệu review.

### 7.10. Notification Service

Chức năng chính:

- Phát thông báo nội bộ hoặc bất đồng bộ khi trạng thái ride thay đổi.

### 7.11. AI Service

Chức năng chính:

- Thực hiện các tác vụ suy luận riêng biệt với stack Node.js.

## 8. Thiết kế dữ liệu và hạ tầng lưu trữ

Hệ thống không dùng một loại database duy nhất mà kết hợp nhiều công nghệ lưu trữ theo tính chất dữ liệu.

### 8.1. PostgreSQL

Dùng cho:

- User, auth, driver, booking, ride, payment.

Lý do:

- Phù hợp với dữ liệu giao dịch và dữ liệu quan hệ cần tính nhất quán cao.

### 8.2. MongoDB

Dùng cho:

- Review.
- Notification.

Lý do:

- Phù hợp với dữ liệu linh hoạt, thiên về document.

### 8.3. Redis

Dùng cho:

- Cache.
- Dữ liệu hỗ trợ realtime.
- Lookup nhanh cho trạng thái hoạt động hoặc vị trí.

### 8.4. RabbitMQ

Dùng cho:

- Truyền event giữa các service.
- Tách rời các bước bất đồng bộ trong ride lifecycle.

## 9. Luồng nghiệp vụ chính

### 9.1. Luồng đặt xe

Khách hàng nhập điểm đón và điểm đến, hệ thống gọi pricing để ước lượng chi phí. Sau khi khách xác nhận, booking được tạo và ride được sinh ra.

Giá trị của luồng này là:

- Bảo đảm khách hàng thấy được thông tin cần thiết trước khi đặt.
- Tạo bản ghi ride làm trung tâm cho các bước tiếp theo.

### 9.2. Luồng ghép tài xế và nhận chuyến

Sau khi ride được tạo, hệ thống cần tìm tài xế phù hợp. Driver đang online sẽ nhận được yêu cầu chuyến. Khi tài xế chấp nhận, ride chuyển từ trạng thái tìm tài xế sang đã có tài xế nhận.

Giá trị của luồng này là:

- Đồng bộ giữa customer app và driver app.
- Chuyển đổi từ trạng thái chờ sang trạng thái vận hành thực tế.

### 9.3. Luồng thực hiện chuyến đi

Tài xế cập nhật theo thứ tự:

- Đã tới điểm đón.
- Bắt đầu chuyến đi.
- Hoàn tất chuyến đi.

Mỗi bước đều làm thay đổi trạng thái ride và phản ánh về customer app cũng như admin dashboard.

### 9.4. Luồng thanh toán và đánh giá

Sau khi ride hoàn tất:

- Payment được sinh ra và cập nhật trạng thái.
- Customer có thể đánh giá tài xế.
- Admin có thể kiểm tra ride và payment tương ứng.

### 9.5. Luồng hủy chuyến

Hệ thống hỗ trợ ít nhất hai tình huống hủy quan trọng:

- Khách hàng hủy trước khi có tài xế nhận.
- Tài xế hủy sau khi đã nhận chuyến.

Việc hỗ trợ rõ các luồng hủy là cần thiết vì đây là trạng thái nghiệp vụ thường gặp trong hệ thống đặt xe thực tế.

## 10. Thiết kế trạng thái ride

Ride là đối tượng trung tâm nên trạng thái của ride cần được quản lý rõ ràng. Trong repo hiện tại có các nhóm trạng thái chính sau:

- PENDING hoặc FINDING_DRIVER.
- ASSIGNED hoặc ACCEPTED.
- PICKING_UP.
- IN_PROGRESS.
- COMPLETED.
- CANCELLED.
- NO_DRIVER_AVAILABLE.

Ý nghĩa thiết kế của state machine này là:

- Hạn chế trạng thái mơ hồ.
- Bảo đảm frontend của từng vai trò biết chính xác đang hiển thị gì.
- Tạo cơ sở để kiểm thử end-to-end và kiểm tra hậu quả nghiệp vụ của từng hành động.

## 11. Thiết kế giao tiếp giữa các thành phần

Hệ thống dùng kết hợp hai kiểu giao tiếp.

### 11.1. Giao tiếp đồng bộ

Thông qua HTTP hoặc API Gateway, phù hợp cho:

- Login.
- Truy vấn dữ liệu user.
- Tạo ride.
- Xem payment.
- Xem history.

### 11.2. Giao tiếp bất đồng bộ

Thông qua RabbitMQ, phù hợp cho:

- Publish event của ride lifecycle.
- Thông báo trạng thái mới.
- Tách rời các service không cần gọi trực tiếp đồng bộ.

### 11.3. Giao tiếp realtime

Thông qua Gateway và Socket.IO, phù hợp cho:

- Cập nhật tài xế nhận chuyến.
- Cập nhật vị trí và trạng thái chuyến.
- Đồng bộ thông tin nhanh giữa customer và driver.

## 12. Thiết kế bảo mật và phân quyền

Về bảo mật, hệ thống áp dụng phân quyền theo vai trò. Các nhóm quyền chính gồm:

- Customer.
- Driver.
- Admin.

Mỗi nhóm chỉ được thao tác trên các màn hình và API phù hợp với vai trò của mình. Điều này quan trọng vì dữ liệu rides, earnings, payments và thông tin quản trị không thể dùng chung một mức truy cập.

## 13. Kiểm thử và đảm bảo chất lượng

Repo hiện tại đã có nhiều tầng kiểm thử khác nhau:

- Unit test.
- Contract test.
- Integration test backend.
- Smoke test gateway.
- Browser smoke test cho các luồng UI chính.
- Kiểm thử thủ công qua 3 ứng dụng frontend.

Thiết kế kiểm thử nhiều tầng giúp phát hiện lỗi ở các mức khác nhau:

- Lỗi logic cục bộ trong service.
- Lỗi hợp đồng giữa service với service.
- Lỗi tích hợp backend.
- Lỗi hành vi thực tế trên giao diện người dùng.

## 14. Triển khai và vận hành

Hệ thống hỗ trợ:

- Docker Compose cho môi trường local.
- Docker Swarm cho hướng triển khai mở rộng.
- GitHub Actions cho quy trình CI/CD.

Việc đóng gói từng service thành container giúp tăng tính độc lập, dễ build lại, dễ triển khai và dễ mở rộng khi cần.

## 15. Đánh giá thiết kế hiện tại

### 15.1. Điểm mạnh

- Kiến trúc chia miền khá rõ ràng.
- Ride lifecycle được tách thành một miền trung tâm dễ quan sát.
- Có nhiều frontend tương ứng đúng actor nghiệp vụ.
- Có sẵn cả hướng test tự động và test thủ công.
- Hạ tầng dữ liệu được chọn theo đúng tính chất dữ liệu thay vì dùng một loại database cho mọi thứ.

### 15.2. Điểm cần cải thiện

- Cần chuẩn hóa thêm các `data-testid` để browser test ổn định hơn.
- Cần làm rõ hơn state transition contract giữa một số service khi xử lý lỗi và cancellation.
- Cần tăng khả năng quan sát trạng thái realtime và health check giữa gateway với các service phụ thuộc.

## 16. Kết luận

Cab Booking System là một hệ thống phù hợp để áp dụng microservices kết hợp Domain Driven Design vì bài toán có nhiều actor, nhiều trạng thái nghiệp vụ và nhiều luồng dữ liệu khác nhau. Trong thiết kế hiện tại, Ride Service đóng vai trò trung tâm của vòng đời chuyến đi, trong khi các service khác hỗ trợ theo bounded context riêng như driver, pricing, payment, review và notification.

Thiết kế này giúp hệ thống:

- Dễ mở rộng theo từng miền nghiệp vụ.
- Dễ kiểm thử hơn so với mô hình nguyên khối.
- Dễ phân vai trò frontend theo actor.
- Dễ đưa vào báo cáo phân tích thiết kế hệ thống vì ranh giới chức năng khá rõ.

Nếu tiếp tục phát triển, hệ thống có thể được hoàn thiện thêm ở các phần tối ưu dispatch, quan sát realtime, chuẩn hóa testing hooks và làm chặt hơn các hợp đồng trạng thái giữa các service.