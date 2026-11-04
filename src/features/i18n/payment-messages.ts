export const paymentEnglish={
 'payment.vnpay':'VNPAY Sandbox','payment.sandbox':'Sandbox payment — no real money is charged.','payment.hosted':'Choose an available card or QR method on VNPAY. Booking confirmation is verified by the server.',
 'payment.pay':'Pay with VNPAY','payment.refresh':'Check payment status','payment.unavailable':'Unable to complete this action. Refresh the status before trying again.',
 'payment.status.pending':'Payment is pending.','payment.status.succeeded':'Payment received.','payment.status.failed':'Payment failed. You can try again while the hold is active.','payment.status.cancelled':'Payment cancelled.',
 'payment.compensation':'Payment received after this booking became unavailable. A full sandbox refund will be processed; no ticket has been issued.',
 'payment.refund':'Request sandbox refund','payment.refundDue':'Refund amount','payment.refundState':'Refund status',
 'payment.refund.ready':'Refund is ready to submit.','payment.refund.submitted':'Refund request submitted.','payment.refund.unknown':'Awaiting gateway verification. Do not submit another refund.',
 'payment.refund.processing':'Refund is processing.','payment.refund.succeeded':'Refund completed.','payment.refund.failed':'Refund was rejected. Contact support.','payment.refund.review':'Refund needs merchant review.',
 'payment.cancel':'Cancel booking','payment.cancelConfirm':'Confirm whole-booking cancellation','payment.keep':'Keep booking','payment.fee':'Cancellation fee','payment.cancelWarning':'Cancel the entire booking? Review the fee and refund amount first.'
};
export const paymentVietnamese:Record<keyof typeof paymentEnglish,string>={
 'payment.vnpay':'VNPAY Sandbox','payment.sandbox':'Thanh toán thử nghiệm — không thu tiền thật.','payment.hosted':'Chọn phương thức thẻ hoặc QR được hỗ trợ trên VNPAY. Server sẽ xác minh kết quả đặt vé.',
 'payment.pay':'Thanh toán qua VNPAY','payment.refresh':'Kiểm tra trạng thái thanh toán','payment.unavailable':'Chưa thể hoàn tất thao tác. Hãy kiểm tra trạng thái trước khi thử lại.',
 'payment.status.pending':'Đang chờ thanh toán.','payment.status.succeeded':'Đã nhận thanh toán.','payment.status.failed':'Thanh toán thất bại. Bạn có thể thử lại khi còn thời gian giữ chỗ.','payment.status.cancelled':'Lần thanh toán đã hủy.',
 'payment.compensation':'Đã nhận thanh toán sau khi đơn không còn khả dụng. Hệ thống sẽ xử lý hoàn toàn bộ trên sandbox; chưa phát hành vé.',
 'payment.refund':'Yêu cầu hoàn tiền sandbox','payment.refundDue':'Số tiền được hoàn','payment.refundState':'Trạng thái hoàn tiền',
 'payment.refund.ready':'Sẵn sàng gửi yêu cầu hoàn.','payment.refund.submitted':'Đã gửi yêu cầu hoàn tiền.','payment.refund.unknown':'Đang chờ xác minh với cổng thanh toán. Không gửi yêu cầu hoàn khác.',
 'payment.refund.processing':'Đang xử lý hoàn tiền.','payment.refund.succeeded':'Đã hoàn tiền.','payment.refund.failed':'Yêu cầu hoàn bị từ chối. Vui lòng liên hệ hỗ trợ.','payment.refund.review':'Yêu cầu hoàn cần kiểm tra trên cổng merchant.',
 'payment.cancel':'Hủy đơn','payment.cancelConfirm':'Xác nhận hủy cả đơn','payment.keep':'Giữ lại đơn','payment.fee':'Phí hủy','payment.cancelWarning':'Hủy toàn bộ đơn đặt vé? Hãy kiểm tra phí và số tiền được hoàn trước.'
};
