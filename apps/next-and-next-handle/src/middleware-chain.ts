type Middleware = (req: any, res: any, next: any) => void;

class MiddlewareClass {
  private readonly middlewares: Array<Middleware> = [];
  private currentMiddlewareIndex = 0;

  use = (middleware: Middleware) => {
    this.middlewares.push(middleware);
  };

  private next = (req: any, res: any, err?: any) => {
    if (err) {
      this.errorHandler(err, req, res);
      return;
    }

    if (this.currentMiddlewareIndex >= this.middlewares.length) {
      this.routerHandler(req, res);
      return;
    }

    const currentMiddleware = this.middlewares[this.currentMiddlewareIndex];
    this.currentMiddlewareIndex++;

    // 🔥 클로저를 활용한 next 함수 래핑
    // - 미들웨어에서 next()를 인자 없이 호출할 수 있도록 함 (Express 스타일)
    // - wrrapedNext가 생성될 때 현재 스코프의 req, res를 캡처
    // - 미들웨어에서 next()만 호출하면 캡처된 req, res가 자동으로 this.next()에 전달됨
    const wrrapedNext = () => {
      this.next(req, res);
    };

    try {
      currentMiddleware(req, res, wrrapedNext);
    } catch (error) {
      this.next(req, res, error);
    }
  };

  excute = (req: any, res: any) => {
    this.next(req, res);
  };

  private routerHandler = (req: any, res: any) => {
    console.log(`✅ req: ${JSON.stringify(req)} \n✅ res: ${JSON.stringify(res)}`);
  };

  private errorHandler(err: any, req: any, res: any) {
    console.error(err);
  }
}

const middleware = new MiddlewareClass();

middleware.use((req, res, next) => {
  console.log(`1️⃣  이전`);
  req.user = { name: 'kim' };
  next();
  console.log(`1️⃣  이후`);
});
middleware.use((req, res, next) => {
  console.log('2️⃣  이전');
  req.user = { ...req.user, age: 2 };
  next(); 
  console.log('2️⃣  이후');
});
middleware.use((req, res, next) => {
  console.log('3️⃣  이전');
  req.user = { ...req.user, nickname: 'nick' };
  next();
  console.log('3️⃣  이후');
});

middleware.excute({}, {});
