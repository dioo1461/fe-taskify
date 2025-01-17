import { generateUid } from '../utils/dataUtil.js'

// TODO: indexing

const createTodoItem = (title, content, author) => {
    return {
        uid: generateUid(),
        title,
        content,
        author,
        createdAt: new Date(),
    }
}

export const TodoItem = createTodoItem
