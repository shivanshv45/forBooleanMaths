// thrown anywhere in a route, caught by the error middleware
export default class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }

  static badRequest(message) {
    return new AppError(400, message);
  }

  static notFound(message) {
    return new AppError(404, message);
  }
}
