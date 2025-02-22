import { TodoItem } from '../domain/todoItem.js'
import { classNames, keys, templateNames } from '../strings.js'
import {
    createDomElementAsChild,
    createDomElementAsSibling,
    findDomElement,
    findDomElementByUid,
    getIdentifierByUid,
    removeDomElement,
    replaceDomElement,
} from '../utils/domUtil.js'
import { getState, setState } from '../utils/stateUtil.js'
import { loadData, storeData } from '../utils/storageUtil.js'
import { manageDragEvents, manageDropEvents } from './dragManager.js'
import { Category } from '../domain/category.js'
import { addHistory } from './historyManager.js'
import { addAction } from './actionManager.js'
import {
    makeTodoAddAction,
    makeTodoDeleteAction,
    makeTodoEditAction,
} from '../utils/actionFactory.js'
import { deepCopy } from '../utils/dataUtil.js'

export const initTodo = () => {
    keys.RESET_DATA_KEY && storeData(keys.TODO_CATEGORY_KEY, null)

    let categoryList = loadData(keys.TODO_CATEGORY_KEY)
    if (!categoryList) {
        storeData(keys.TODO_CATEGORY_KEY, [])
        categoryList = []
    }

    // 더미 데이터 초기화 로직
    if (keys.RESET_DATA_KEY) {
        let id = 1
        let categoryCnt = 3
        let eleCnt = 3

        const res = []
        for (let i = 0; i < categoryCnt; i++) {
            res.push(Category(`id-${id}`))
            id += eleCnt + 1
        }
        categoryList = res

        id = 1
        categoryList.forEach((category, index) => {
            const res = []
            for (let i = 0; i < eleCnt; i++) {
                id++
                res.push(TodoItem(`id-${id}`, `내용 - ${index}-${i}`, 'web'))
            }
            id += 1
            category.todoList = res
        })
        storeData(keys.TODO_CATEGORY_KEY, categoryList)
    }

    // 메인 로직
    categoryList.map((category) => reRenderColumn(category))
    setState(keys.TODO_CATEGORY_KEY, categoryList)

    let sortNewestOrder = true
    const todoSortBtn = document.querySelector(`.${classNames.headerSortBtn}`)

    todoSortBtn.addEventListener('click', (e) => {
        sortCategories(sortNewestOrder)
        sortNewestOrder = !sortNewestOrder
        todoSortBtn.querySelector(
            `.${classNames.headerSortBtnLabel}`
        ).textContent = sortNewestOrder ? '최신 순' : '생성 순'
    })

    const categoryAddBtn = document.querySelector(
        `.${classNames.addCategoryBtn}`
    )
    categoryAddBtn.addEventListener('click', () => {
        handleCategoryCreate()
    })
}

const handleCategoryCreate = () => {
    const newCategory = Category('새로운 카테고리')
    reRenderColumn(newCategory)

    const categoryList = getState(keys.TODO_CATEGORY_KEY)
    categoryList.push(newCategory)
    storeData(keys.TODO_CATEGORY_KEY, categoryList)
}

const handleCategoryDelete = (category) => {
    const categoryList = getState(keys.TODO_CATEGORY_KEY)
    const idx = categoryList.indexOf(category)
    categoryList.splice(idx, 1)
    storeData(keys.TODO_CATEGORY_KEY, categoryList)
    findDomElementByUid(category.uid).remove()
}

const reRenderColumn = (category) => {
    const mainElement = document.querySelector('.main')
    const parentElement = findDomElementByUid(category.uid)
    parentElement ? removeDomElement(parentElement.id) : null

    const categoryId = createDomElementAsChild(
        templateNames.todoHeader,
        mainElement,
        (identifier, component) => {
            component = component.querySelector(`.${classNames.todoContainer}`)
            component.querySelector(
                `.${classNames.todoHeaderTitle}`
            ).textContent = category.categoryName
            component
                .querySelector(`.${classNames.addButton}`)
                .addEventListener('click', () => {
                    onAddTodoButtonClick(category)
                })
            component
                .querySelector(`.${classNames.deleteButton}`)
                .addEventListener('click', () => {
                    handleCategoryDelete(category)
                })

            manageDropEvents(component, category)
            return category.uid
        }
    )
    category.todoFormDomId = null
    category.todoList.map((todoItem) => {
        createDomElementAsChild(
            templateNames.todoItem,
            findDomElement(categoryId).querySelector(`.${classNames.todoBody}`),
            (identifier, component) => {
                initTodoItemElement(component, todoItem)
                return todoItem.uid
            }
        )
    })

    renewTodoCount(category)
}

const onAddTodoButtonClick = (category) => {
    if (category.todoFormDomId) {
        disableAddTodoForm(category)
    } else {
        enableAddTodoForm(category)
    }
}

// TODO: form이 비어 있으면 submit 버튼 비활성화
const enableAddTodoForm = (category) => {
    const todoBodyElement = findDomElementByUid(category.uid).querySelector(
        `.${classNames.todoBody}`
    )
    const formId = createDomElementAsChild(
        templateNames.todoItemAddForm,
        todoBodyElement,
        (identifier, component) => {
            component
                .querySelector(`.${classNames.todoAddFormSubmitBtn}`)
                .addEventListener('click', () => {
                    const formElement = findDomElement(identifier)
                    const title = formElement.querySelector(
                        `.${classNames.todoAddFormInputTitle}`
                    ).value
                    const content = formElement.querySelector(
                        `.${classNames.todoAddFormInputContent}`
                    ).value
                    const author = 'web'
                    const todoItem = TodoItem(title, content, author)
                    handleTodoCreate(todoItem, category)
                    category.todoFormDomId = null
                    removeDomElement(identifier)
                })
            component
                .querySelector(`.${classNames.todoAddFormCancelBtn}`)
                .addEventListener('click', () => {
                    category.todoFormDomId = null
                    removeDomElement(identifier)
                })
            return null
        },
        false
    )
    // state에 변경사항 반영
    category.todoFormDomId = formId
}

const disableAddTodoForm = (category) => {
    removeDomElement(category.todoFormDomId)
    category.todoFormDomId = null
}

const initTodoItemElement = (todoElement, todoItem) => {
    const { uid, title, content, author } = todoItem

    todoElement.querySelector(`.${classNames.todoItemTitle}`).textContent =
        title
    todoElement.querySelector(`.${classNames.todoItemContent}`).textContent =
        content
    todoElement.querySelector(
        `.${classNames.todoItemAuthor}`
    ).textContent = `author by ${author}`
    // category 정보 어떻게 얻어올 것인지 ?
    todoElement
        .querySelector(`.${classNames.deleteButton}`)
        .addEventListener('click', () => {
            handleTodoDelete(uid)
        })
    todoElement
        .querySelector(`.${classNames.editButton}`)
        .addEventListener('click', () => {
            handleTodoEdit(uid)
        })
    manageDragEvents(todoElement.querySelector(`.${classNames.todoItemBody}`))
}

const handleTodoCreate = (todoItem, category) => {
    const todoBodyElement = findDomElementByUid(category.uid).querySelector(
        `.${classNames.todoBody}`
    )
    createDomElementAsChild(
        templateNames.todoItem,
        todoBodyElement,
        (identifier, component) => {
            addTodoItemToList(todoItem, category, 0)
            initTodoItemElement(component, todoItem)
            return todoItem.uid
        },
        false
    )

    // category 객체를 참조하므로 setState를 안 해도 변경이 되긴 함 .. 맘에 안들지만 일단은 이렇게
    storeData(keys.TODO_CATEGORY_KEY, getState(keys.TODO_CATEGORY_KEY))
    renewTodoCount(category)
    const todoAddAction = makeTodoAddAction(category.uid, todoItem)
    addAction(todoAddAction)
    addHistory(todoAddAction)
    return getIdentifierByUid(todoItem.uid)
}

const addTodoItemToList = (todoItem, category, index) => {
    const todoList = category.todoList
    category.todoList = [
        ...todoList.slice(0, index),
        todoItem,
        ...todoList.slice(index),
    ]
}

const getTodoItemInfo = (todoItemUid) => {
    const categoryList = getState(keys.TODO_CATEGORY_KEY)
    for (let category of categoryList) {
        for (let [idx, todo] of category.todoList.entries()) {
            if (todo.uid === todoItemUid) {
                return { category: category, index: idx, todoItem: todo }
            }
        }
    }
    return null
}

const handleTodoDelete = (uid) => {
    const { category, index, todoItem } = getTodoItemInfo(uid)
    category.todoList.splice(index, 1)
    const identifier = getIdentifierByUid(uid)
    removeDomElement(identifier)
    renewTodoCount(category)
    storeData(keys.TODO_CATEGORY_KEY, getState(keys.TODO_CATEGORY_KEY))

    const todoDeleteAction = makeTodoDeleteAction(category.uid, todoItem, index)
    addAction(todoDeleteAction)
    addHistory(todoDeleteAction)
}

const handleTodoEdit = (todoItemUid) => {
    const {
        category,
        index: targetIdx,
        todoItem,
    } = getTodoItemInfo(todoItemUid)
    const originTodoItem = deepCopy(todoItem)
    const {
        uid: originUid,
        title: originTitle,
        content: originContent,
        author: originAuthor,
    } = originTodoItem

    const originTodoElement = findDomElementByUid(originUid)
    console.log(originUid, todoItemUid, originTodoElement)
    replaceDomElement(
        templateNames.todoItemEditForm,
        originTodoElement,
        (identifier, component) => {
            component.querySelector(
                `.${classNames.todoEditFormInputTitle}`
            ).value = originTitle
            component.querySelector(
                `.${classNames.todoEditFormInputContent}`
            ).value = originContent
            component
                .querySelector(`.${classNames.todoEditFormSubmitBtn}`)
                .addEventListener('click', () => {
                    const editFormElement = findDomElement(identifier)
                    const title = editFormElement.querySelector(
                        `.${classNames.todoEditFormInputTitle}`
                    ).value
                    const content = editFormElement.querySelector(
                        `.${classNames.todoEditFormInputContent}`
                    ).value
                    // TODO: author 정보 동적으로 가져오기
                    const author = 'web'
                    replaceDomElement(
                        templateNames.todoItem,
                        editFormElement,
                        (identifier, component) => {
                            todoItem.title = title
                            todoItem.content = content
                            todoItem.author = author
                            initTodoItemElement(component, todoItem)
                            return todoItem.uid
                        }
                    )
                    storeData(
                        keys.TODO_CATEGORY_KEY,
                        getState(keys.TODO_CATEGORY_KEY)
                    )
                    const todoEditAction = makeTodoEditAction(
                        category.uid,
                        originTodoItem,
                        todoItem,
                        category.todoList.indexOf(todoItem)
                    )
                    addAction(todoEditAction)
                    addHistory(todoEditAction)
                })
            component
                .querySelector(`.${classNames.todoEditFormCancelBtn}`)
                .addEventListener('click', () => {
                    replaceDomElement(
                        templateNames.todoItem,
                        findDomElement(identifier),
                        (identifier, component) => {
                            initTodoItemElement(component, originTodoItem)
                            return originTodoItem.uid
                        }
                    )
                })
        }
    )
}

export const renewTodoCount = (category) => {
    const todoCount = findDomElementByUid(category.uid).querySelector(
        `.${classNames.todoHeaderTodoCount}`
    )
    todoCount.textContent = category.todoList.length
}

const sortCategories = (isNewestOrder) => {
    const categoryList = getState(keys.TODO_CATEGORY_KEY)
    for (let category of categoryList) {
        if (isNewestOrder) {
            category.todoList.sort((a, b) => a.createdAt - b.createdAt)
        } else {
            category.todoList.sort((a, b) => b.createdAt - a.createdAt)
        }
        reRenderColumn(category)
    }
    storeData(keys.TODO_CATEGORY_KEY, categoryList)
}

// ########## UNDO / REDO ##########

export const undoTodoItemCreate = (category, todoItem) => {
    removeDomElement(findDomElementByUid(todoItem.uid).id)
    category.todoList.splice(0, 1)
    renewTodoCount(category)
}

export const undoTodoItemDelete = (category, todoItem, index) => {
    const copiedTodoItem = deepCopy(todoItem)
    const todoBodyElement = findDomElementByUid(category.uid).querySelector(
        `.${classNames.todoBody}`
    )

    if (index === category.todoList.length) {
        createDomElementAsChild(
            templateNames.todoItem,
            todoBodyElement,
            (identifier, component) => {
                initTodoItemElement(component, copiedTodoItem)
                return copiedTodoItem.uid
            },
            true
        )
    } else {
        const originChildElement = findDomElementByUid(
            category.todoList[index].uid
        )
        createDomElementAsSibling(
            templateNames.todoItem,
            originChildElement,
            (identifier, component) => {
                initTodoItemElement(component, copiedTodoItem)
                return copiedTodoItem.uid
            },
            false
        )
    }

    addTodoItemToList(copiedTodoItem, category, index)
    renewTodoCount(category)
}

export const undoTodoItemEdit = (
    category,
    prevTodoItem,
    currentTodoItem,
    index
) => {
    const originTodoElement = findDomElementByUid(currentTodoItem.uid)
    replaceDomElement(
        templateNames.todoItem,
        originTodoElement,
        (identifier, component) => {
            initTodoItemElement(component, prevTodoItem)
            return prevTodoItem.uid
        }
    )
}

export const redoTodoItemCreate = (category, todoItem) => {
    const copiedTodoItem = deepCopy(todoItem)
    createDomElementAsChild(
        templateNames.todoItem,
        findDomElementByUid(category.uid).querySelector(
            `.${classNames.todoBody}`
        ),
        (identifier, component) => {
            initTodoItemElement(component, todoItem)
            return todoItem.uid
        },
        false
    )
    category.todoList.unshift(copiedTodoItem)
    renewTodoCount(category)
}

export const redoTodoItemDelete = (category, todoItem, index) => {
    removeDomElement(findDomElementByUid(todoItem.uid).id)
    category.todoList.splice(index, 1)
    renewTodoCount(category)
}

export const redoTodoItemEdit = (
    category,
    prevTodoItem,
    currentTodoItem,
    index
) => {
    const originTodoElement = findDomElementByUid(prevTodoItem.uid)
    replaceDomElement(
        templateNames.todoItem,
        originTodoElement,
        (identifier, component) => {
            initTodoItemElement(component, currentTodoItem)
            return currentTodoItem.uid
        }
    )
}
