import {
  CREATE_BOARD, CREATE_BOARD_SUCCESS,
  BOARD_LIST_REQUEST, BOARD_LIST_SUCCESS,
  LOAD_BOARD, LOAD_BOARD_SUCCESS,
  MODIFY_BOARD, MODIFY_BOARD_SUCCESS,
  CREATE_LIST_REQUEST, CREATE_LIST_REQUEST_SUCCESS,
  CREATE_TASK_REQUEST, CREATE_TASK_REQUEST_SUCCESS
} from '../actions/board_action_enum';

const INITIAL_STATE = {
  boardList: [],
  isLoadingBoardList: false,
  isCreatingBoard: false,
  isLoadingBoard: false,
  boardPropertiesById: {},
  boardListRelationshipByBoardId: {},
  listsById: {},
  taskListRelationshipByListId: {},
  taskById: {},
  __optimisticModifier: []
};

export function board(state = INITIAL_STATE, action =null) {
  switch (action.type) {
    case BOARD_LIST_REQUEST:
      return Object.assign({}, state, {
        isLoadingBoardList: true
      });
    case BOARD_LIST_SUCCESS:
      return Object.assign({}, state, {
        isLoadingBoardList: false,
        boardList: action.boards
      });
    case CREATE_BOARD:
      return Object.assign({}, state, {
        isCreatingBoard: true
      });
    case CREATE_BOARD_SUCCESS:
      return Object.assign({}, state, {
        isCreatingBoard: false,
        boardList: [...state.boardList, action.board]
      });
    case LOAD_BOARD:
      return Object.assign({}, state, {
        isLoadingBoard: true,
      });
    case LOAD_BOARD_SUCCESS:
      return handleLoadBoardSuccess(state, action);
    case MODIFY_BOARD:
      return handleModifyBoard(state, action);
    case MODIFY_BOARD_SUCCESS:
      const newBoardList = state.boardList.map(board => {
        return board.id === action.board.id ? action.board : board;
      });
      return Object.assign({}, state, {
        isModifyingBoard: false,
        boardList: newBoardList,
        boardPropertiesById: Object.assign({}, state.boardPropertiesById, {
          [action.board.id]: action.board
        }),
        __optimisticModifier: state.__optimisticModifier.filter(filterOutRequest(action.requestId))
      });
    case CREATE_LIST_REQUEST:
      return handleCreateListRequest(state, action);
    case CREATE_LIST_REQUEST_SUCCESS:
      return handleCreateListRequestSuccess(state, action);
    case CREATE_TASK_REQUEST:
      const modifyFn = (cState) => {
        const taskById = Object.assign({}, cState.taskById, {
          [action.requestId]: Object.assign({}, action.task, {status: 'NEW'})
        });
        const existingTasksForList = cState.taskListRelationshipByListId[action.task.boardListId] || [];
        const lastRelation = existingTasksForList[existingTasksForList.length - 1];
        const relPos = lastRelation ? lastRelation.position + 1 : 0;
        const newRel = {position: relPos, taskId: action.requestId};
        const taskListRelationshipByListId =
          Object.assign({}, cState.taskListRelationshipByListId, {
            [action.task.boardListId]: [...existingTasksForList, newRel]
          });
        return Object.assign({}, cState, {taskById, taskListRelationshipByListId});
      };
      return Object.assign({}, state, {
        __optimisticModifier: [
          ...state.__optimisticModifier, {requestId: action.requestId, fn: modifyFn}]
      });
    case CREATE_TASK_REQUEST_SUCCESS:
      return createTaskRequestSuccess(state, action);
    default:
      return state;
  }
}

function sortByPosition(item1, item2) {
  return item1.position - item2.position;
}

function handleLoadBoardSuccess(state, action) {
  const boardPropertiesById =
    Object.assign({}, state.boardPropertiesById, {
      [action.board.id]: {
        id: action.board.id,
        name: action.board.name,
        isArchived: action.board.isArchived
      }
    });

  const boardListRelations =
    action.board.lists.edges.map(edge => ({position: edge.position, listId: edge.node.id}));
  boardListRelations.sort(sortByPosition);

  const boardListRelationshipByBoardId =
    Object.assign({}, state.boardListRelationshipByBoardId, {
      [action.board.id]: boardListRelations
    });

  const listsByIdForBoard = action.board.lists.edges.reduce((agg, edge) => {
    const listEntry = {id: edge.node.id, boardId: action.board.id, name: edge.node.name};
    agg[listEntry.id] = listEntry;
    return agg;
  }, {});

  const listsById =
    Object.assign({}, state.listsById, listsByIdForBoard);

  const newTaskListRelationsByListId = action.board.lists.edges.reduce((agg, edge) => {
    const relations = edge.node.tasks.edges.map(t => ({position: t.position, taskId: t.node.id}));
    relations.sort(sortByPosition);
    agg[edge.node.id] = relations;
    return agg;
  }, {});

  const taskListRelationshipByListId =
    Object.assign({}, state.taskListRelationshipByListId, newTaskListRelationsByListId);

  const newTasksById =
    action.board.lists.edges.reduce((agg, listEdge) => {
      listEdge.node.tasks.edges.forEach(taskEdge => {
        agg[taskEdge.node.id] = {
          id: taskEdge.node.id,
          name: taskEdge.node.name,
          listId: listEdge.node.id
        };
      });
      return agg;
    }, {});

  const taskById = Object.assign({}, state.taskById, newTasksById);

  return Object.assign({}, state, {
    isLoadingBoard: false,
    boardPropertiesById,
    boardListRelationshipByBoardId,
    listsById,
    taskListRelationshipByListId,
    taskById
  });
}

function handleCreateListRequestSuccess(state, action) {
  const newRelation = {listId: action.list.id, position: action.list.position};
  const relationsForBoard = [...state.boardListRelationshipByBoardId[action.list.boardId], newRelation];
  relationsForBoard.sort(sortByPosition);

  const boardListRelationshipByBoardId =
    Object.assign({}, state.boardListRelationshipByBoardId, {
      [action.list.boardId]: relationsForBoard
    });
  const newList = {id: action.list.id, name: action.list.name, boardId: action.list.boardId};
  const listsById =
    Object.assign({}, state.listsById, {
      [action.list.id]: newList
    });
  return Object.assign({}, state, {
    boardListRelationshipByBoardId,
    listsById,
    __optimisticModifier: state.__optimisticModifier.filter(filterOutRequest(action.requestId))
  });
}

function createTaskRequestSuccess(state, action) {
  const previousRelationsForList = state.taskListRelationshipByListId[action.task.boardListId] || [];
  const newRelationsForList = [...previousRelationsForList, {position: action.task.position, taskId: action.task.id}];

  const taskListRelationshipByListId = Object.assign({}, state.taskListRelationshipByListId, {
    [action.task.boardListId]: newRelationsForList
  });

  const newTask = {id: action.task.id, name: action.task.name, listId: action.task.boardListId};

  const taskById = Object.assign({}, state.taskById, {
    [action.task.id]: newTask
  });
  return Object.assign({}, state, {
    taskListRelationshipByListId,
    taskById,
    __optimisticModifier: state.__optimisticModifier.filter(filterOutRequest(action.requestId))
  });
}

function handleModifyBoard(state, action) {
  const modifyFn = (cState) => {
    const boardPropertiesById = Object.assign({}, cState.boardPropertiesById, {
      [action.boardId]: Object.assign({}, cState.boardPropertiesById[action.boardId], action.board)
    });
    return Object.assign({}, cState, {boardPropertiesById});
  };

  return Object.assign({}, state, {
    isModifyingBoard: true,
    __optimisticModifier: [
      ...state.__optimisticModifier, {requestId: action.requestId, fn: modifyFn}]
  });
}

function handleCreateListRequest(state, action) {
  const modifyFn = (cState) => {
    const listsById = Object.assign({}, cState.listsById, {
      [action.requestId]: Object.assign({}, action.list)
    });
    const existingListsForBoard = cState.boardListRelationshipByBoardId[action.list.boardId] || [];
    const lastRelation = existingListsForBoard[existingListsForBoard.length - 1];
    const relPos = lastRelation ? lastRelation.position + 1 : 0;
    const newRel = {position: relPos, listId: action.requestId};
    const boardListRelationshipByBoardId =
      Object.assign({}, cState.boardListRelationshipByBoardId, {
        [action.list.boardId]: [...existingListsForBoard, newRel]
      });
    return Object.assign({}, cState, {listsById, boardListRelationshipByBoardId});
  };
  return Object.assign({}, state, {
    __optimisticModifier: [
      ...state.__optimisticModifier, {requestId: action.requestId, fn: modifyFn}]
  });
}

function filterOutRequest(requestId) {
  return (om) => om.requestId !== requestId;
}
