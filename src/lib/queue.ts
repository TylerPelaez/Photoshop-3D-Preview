interface QueueItems<T> {
  [prop: number]: T;
}

export default class Queue<T> {
  items: QueueItems<T>
  frontIndex: number
  backIndex: number

  constructor() {
      this.items = {}
      this.frontIndex = 0
      this.backIndex = 0
  }
  enqueue(item: T): T {
      this.items[this.backIndex] = item
      this.backIndex++
      return item
  }
  dequeue(): T {
      const item = this.items[this.frontIndex]
      delete this.items[this.frontIndex]
      this.frontIndex++
      return item
  }
  peek(): T {
      return this.items[this.frontIndex]
  }
  empty(): boolean {
    return this.backIndex === this.frontIndex;
  }
  get printQueue() {
      return this.items;
  }
}