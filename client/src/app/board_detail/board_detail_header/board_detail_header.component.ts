import { Component, OnInit, Input} from '@angular/core';
import { BoardActionDispatcher } from '../../actions/board_actions';

@Component({
  selector: 'board-detail-header',
  templateUrl: './board_detail_header.component.html',
  styleUrls: ['./board_detail_header.component.scss']
})
export class BoardDetailHeaderComponent implements OnInit {

  @Input('boardProperties') boardProperties: Object;

  constructor(private boardActionDispatcher: BoardActionDispatcher) {
  }

  ngOnInit() {
  }

  ngOnDestroy() {
  }
}