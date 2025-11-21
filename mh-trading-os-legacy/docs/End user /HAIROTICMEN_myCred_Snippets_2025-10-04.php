<?php
/**
 * HAIROTICMEN – myCred Automation Snippets
 * Place in a small must‑use plugin or child theme functions.php
 */

// 1) First completed order bonus (+50 once)
add_action('woocommerce_order_status_completed', function($order_id){
    $order = wc_get_order($order_id);
    if(!$order) return;
    $user_id = $order->get_user_id();
    if(!$user_id) return;

    if( ! function_exists('mycred_add') ) return;

    // check if user already received first‑order bonus
    $has = mycred_get_users_total_accumulated_points( $user_id, 'mycred_default', ['ref' => 'first_order_bonus'] );
    if( floatval($has) > 0 ) return;

    // is this the first completed order?
    $orders = wc_get_orders([ 'customer_id' => $user_id, 'status' => 'completed', 'return' => 'ids', 'limit' => -1 ]);
    if( count($orders) > 1 ) return;

    mycred_add(
        'first_order_bonus',
        $user_id,
        50,
        'Glückwunsch! Erste Bestellung abgeschlossen: +%plural%.',
        $order_id,
        ['order_id' => $order_id],
        'mycred_default'
    );
});

// 2) Purchase points: 1 point per € (subtotal only)
add_action('woocommerce_order_status_completed', function($order_id){
    $order = wc_get_order($order_id);
    if(!$order) return;
    $user_id = $order->get_user_id();
    if(!$user_id) return;
    if( ! function_exists('mycred_add') ) return;

    // prevent double credit: check if already credited for this order
    $log = new myCRED_Query_Log( array('ref' => 'order_purchase', 'ref_id' => $order_id, 'user_id' => $user_id ) );
    if( $log->have_entries() ) return;

    $subtotal = $order->get_subtotal(); // excludes shipping & tax
    $points   = floor( $subtotal * 1 ); // 1 € = 1 point

    if($points > 0){
        mycred_add(
            'order_purchase',
            $user_id,
            $points,
            '%plural% für Einkauf #%order_id%.',
            $order_id,
            ['order_id' => $order_id, 'subtotal' => $subtotal],
            'mycred_default'
        );
    }
});

// 3) Review approved (+10) – product reviews only
add_action('comment_unapproved_to_approved', function($comment){
    if( is_numeric($comment) ) $comment = get_comment($comment);
    if( ! $comment ) return;
    if( $comment->comment_type !== 'review' ) return;

    $user_id = $comment->user_id;
    if(!$user_id) return;
    if( ! function_exists('mycred_add') ) return;

    // limit 1 per order/product – basic throttle by post/user/day
    $today = date('Y-m-d');
    $log = new myCRED_Query_Log( array('ref' => 'product_review', 'user_id' => $user_id, 'time' => ['start' => strtotime($today), 'end' => strtotime($today.' 23:59:59')] ) );
    if( $log->have_entries() ) return;

    mycred_add(
        'product_review',
        $user_id,
        10,
        'Danke für deine Produktbewertung: +%plural%.',
        $comment->comment_post_ID,
        ['comment_id' => $comment->comment_ID],
        'mycred_default'
    );
});

// 4) Repurchase within 30 days (+15)
add_action('woocommerce_order_status_completed', function($order_id){
    $order = wc_get_order($order_id);
    if(!$order) return;
    $user_id = $order->get_user_id();
    if(!$user_id) return;
    if( ! function_exists('mycred_add') ) return;

    // get previous completed orders (exclude current)
    $orders = wc_get_orders([ 'customer_id' => $user_id, 'status' => 'completed', 'exclude' => [$order_id], 'return' => 'ids', 'orderby' => 'date', 'order' => 'DESC', 'limit' => 1 ]);
    if( empty($orders) ) return;
    $prev_id = $orders[0];
    $prev    = wc_get_order($prev_id);
    if( ! $prev ) return;

    $diff_days = ( strtotime( $order->get_date_completed() ) - strtotime( $prev->get_date_completed() ) ) / DAY_IN_SECONDS;
    if( $diff_days <= 30 ){
        // prevent duplicate for same order
        $log = new myCRED_Query_Log( array('ref' => 'repurchase_30d', 'ref_id' => $order_id, 'user_id' => $user_id ) );
        if( $log->have_entries() ) return;

        mycred_add(
            'repurchase_30d',
            $user_id,
            15,
            'Wieder da! Extra‑Bonus: +%plural%.',
            $order_id,
            ['prev_order_id' => $prev_id],
            'mycred_default'
        );
    }
});

// 5) (Optional) Redemption rule is typically configured in myCred Gateway/Hook settings.
//    Ensure max redeem percent (e.g., 20%) and min cart (e.g., 20€) in plugin options.
