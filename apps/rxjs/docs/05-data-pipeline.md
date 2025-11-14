# Data Pipeline Processing with RxJS 🔄

> 여러 데이터 소스를 조합하고 변환하는 복잡한 파이프라인 구현

## 📚 핵심 Operator

### 병렬 처리
- **forkJoin**: 모든 Observable 완료 대기 → 한 번에 결과 반환
- **combineLatest**: 각 Observable의 최신 값 조합 (실시간 업데이트)
- **zip**: 같은 인덱스 값끼리 조합

### 순차 처리
- **concatMap**: 순서 보장, 이전 완료 후 다음 실행
- **switchMap**: 최신 요청만 처리, 이전 취소
- **mergeMap**: 동시 실행, 순서 무관
- **exhaustMap**: 진행 중이면 새 요청 무시

---

## 🚀 실전 패턴

### Pattern 1: 병렬 API 호출 (forkJoin)

```typescript
@Injectable()
export class UserDashboardService {
  constructor(
    private userService: UserService,
    private orderService: OrderService,
    private recommendationService: RecommendationService,
  ) {}

  getDashboardData(userId: string): Observable<DashboardData> {
    return forkJoin({
      user: this.userService.getUser(userId),
      recentOrders: this.orderService.getRecentOrders(userId, 5),
      recommendations: this.recommendationService.getFor(userId),
      statistics: this.orderService.getStatistics(userId),
    }).pipe(
      map(({ user, recentOrders, recommendations, statistics }) => ({
        userName: user.name,
        email: user.email,
        orders: recentOrders,
        recommendations: recommendations.slice(0, 10),
        totalSpent: statistics.totalAmount,
        orderCount: statistics.count,
      })),
      timeout(5000),
      retry(2),
      catchError((error) => {
        console.error('Dashboard data fetch failed:', error);
        return of(this.getDefaultDashboard());
      })
    );
  }
}
```

### Pattern 2: 의존적 순차 호출 (switchMap)

```typescript
@Injectable()
export class CheckoutService {
  processCheckout(cartId: string): Observable<OrderResult> {
    return this.cartService.getCart(cartId).pipe(
      // 1단계: 장바구니 조회
      switchMap((cart) =>
        // 2단계: 재고 확인 (장바구니 정보 필요)
        this.inventoryService.checkStock(cart.items).pipe(
          map((hasStock) => ({ cart, hasStock }))
        )
      ),
      switchMap(({ cart, hasStock }) => {
        if (!hasStock) {
          throw new Error('재고 부족');
        }
        // 3단계: 결제 처리
        return this.paymentService.process(cart).pipe(
          map((payment) => ({ cart, payment }))
        );
      }),
      switchMap(({ cart, payment }) =>
        // 4단계: 주문 생성
        this.orderService.create({
          cartId: cart.id,
          paymentId: payment.id,
          items: cart.items,
        })
      )
    );
  }
}
```

### Pattern 3: 실시간 데이터 조합 (combineLatest)

```typescript
@Injectable()
export class LivePricingService {
  constructor(
    private stockPriceStream: StockPriceService,
    private exchangeRateStream: ExchangeRateService,
    private userSettingsStream: UserSettingsService,
  ) {}

  getUserStockPrice(userId: string, symbol: string): Observable<PriceData> {
    return combineLatest([
      this.stockPriceStream.subscribe(symbol),
      this.exchangeRateStream.subscribe('USD', 'KRW'),
      this.userSettingsStream.getSettings(userId),
    ]).pipe(
      map(([stockPrice, exchangeRate, settings]) => ({
        symbol,
        priceUSD: stockPrice.price,
        priceKRW: stockPrice.price * exchangeRate,
        currency: settings.preferredCurrency,
        displayPrice: settings.preferredCurrency === 'USD' 
          ? stockPrice.price 
          : stockPrice.price * exchangeRate,
        timestamp: new Date(),
      })),
      distinctUntilChanged((prev, curr) => 
        prev.displayPrice === curr.displayPrice
      )
    );
  }
}
```

### Pattern 4: 데이터 변환 파이프라인

```typescript
@Injectable()
export class ReportGenerationService {
  generateMonthlyReport(userId: string, month: string): Observable<Report> {
    return this.orderService.getOrdersByMonth(userId, month).pipe(
      // 1. 주문 데이터 가져오기
      map((orders) => orders.filter((o) => o.status === 'DELIVERED')),
      // 2. 배송 완료된 주문만 필터링
      switchMap((orders) =>
        forkJoin(
          orders.map((order) =>
            this.productService.getProduct(order.productId).pipe(
              map((product) => ({ ...order, productName: product.name }))
            )
          )
        )
      ),
      // 3. 상품 정보 추가
      map((ordersWithProducts) =>
        ordersWithProducts.reduce(
          (acc, order) => {
            acc.totalAmount += order.amount;
            acc.totalCount += 1;
            acc.items.push({
              productName: order.productName,
              quantity: order.quantity,
              amount: order.amount,
            });
            return acc;
          },
          { totalAmount: 0, totalCount: 0, items: [] }
        )
      ),
      // 4. 통계 계산
      map((stats) => ({
        userId,
        month,
        summary: {
          totalOrders: stats.totalCount,
          totalSpent: stats.totalAmount,
          avgOrderValue: stats.totalAmount / stats.totalCount,
        },
        details: stats.items,
        generatedAt: new Date(),
      }))
    );
  }
}
```

### Pattern 5: 에러 처리 및 Fallback

```typescript
@Injectable()
export class ResilientDataService {
  getDataWithFallback(id: string): Observable<Data> {
    return this.primaryService.getData(id).pipe(
      timeout(3000),
      retry({
        count: 2,
        delay: (error, retryCount) => timer(1000 * retryCount),
      }),
      catchError((error) => {
        console.warn('Primary service failed, trying secondary');
        return this.secondaryService.getData(id).pipe(
          timeout(5000),
          catchError(() => {
            console.warn('Secondary service failed, using cache');
            return this.cacheService.getData(id).pipe(
              catchError(() => {
                console.error('All sources failed, returning default');
                return of(this.getDefaultData(id));
              })
            );
          })
        );
      })
    );
  }
}
```

---

## 📝 실습 과제

### 과제 1: 대시보드 API ⭐⭐
사용자 정보 + 주문 내역 + 추천 상품을 병렬로 가져와 조합

### 과제 2: 체크아웃 플로우 ⭐⭐⭐
장바구니 → 재고 확인 → 결제 → 주문 생성 순차 처리

### 과제 3: 실시간 대시보드 ⭐⭐⭐
여러 데이터 스트림을 실시간으로 조합하여 표시

### 과제 4: 리포트 생성 ⭐⭐⭐
복잡한 데이터 변환 파이프라인 구현

### 과제 5: 다단계 Fallback ⭐⭐⭐⭐
Primary → Secondary → Cache → Default 순으로 폴백

---

## 🎓 Operator 선택 가이드

```
병렬 처리가 필요한가?
└─ YES → 모든 결과 필요? → forkJoin
       → 실시간 업데이트? → combineLatest

순차 처리가 필요한가?
└─ YES → 순서 보장? → concatMap
       → 최신 것만? → switchMap
       → 동시 실행? → mergeMap
       → 진행 중 무시? → exhaustMap
```

**다음:** [06-microservices.md](./06-microservices.md)
