<?php
/**
 * Plugin Name: Isoteh ads
 * Description: Show ads from your Isoteh slots with [isoteh slot="sl_..."]. Set the server address under Settings, Isoteh.
 * Version: 1.0.0
 * License: GPLv2 or later
 *
 * This small file is the only Isoteh code that runs inside WordPress. WordPress plugins are usually released under
 * WordPress's own licence (GPL), so it carries that licence; the ad server it talks to is separate software.
 */
if (!defined('ABSPATH')) exit;

function isoteh_server() { return rtrim(esc_url_raw(get_option('isoteh_server', '')), '/'); }

add_shortcode('isoteh', function ($atts) {
  $a = shortcode_atts(array('slot' => '', 'keywords' => '', 'width' => '', 'height' => ''), $atts, 'isoteh');
  $server = isoteh_server();
  if (!$server || !preg_match('/^[A-Za-z0-9_]{3,32}$/', $a['slot'])) return '';
  wp_enqueue_script('isoteh', $server . '/s/isoteh.js', array(), null, array('strategy' => 'async', 'in_footer' => true));
  $style = ($a['width'] && $a['height']) ? sprintf(' style="max-width:%dpx;aspect-ratio:%d/%d"', intval($a['width']), intval($a['width']), intval($a['height'])) : '';
  return sprintf('<div data-isoteh="%s" data-keywords="%s"%s></div>', esc_attr($a['slot']), esc_attr($a['keywords']), $style);
});

add_action('admin_menu', function () {
  add_options_page('Isoteh', 'Isoteh', 'manage_options', 'isoteh', function () {
    if (!current_user_can('manage_options')) return;
    echo '<div class="wrap"><h1>Isoteh</h1><form method="post" action="options.php">';
    settings_fields('isoteh');
    echo '<p><label>Ad server address<br><input class="regular-text" name="isoteh_server" value="' . esc_attr(get_option('isoteh_server', '')) . '" placeholder="https://ads.example.com"></label></p>';
    echo '<p>Then put <code>[isoteh slot="your-slot-id"]</code> in any post, page or widget.</p>';
    submit_button();
    echo '</form></div>';
  });
});
add_action('admin_init', function () { register_setting('isoteh', 'isoteh_server', array('sanitize_callback' => 'esc_url_raw')); });
